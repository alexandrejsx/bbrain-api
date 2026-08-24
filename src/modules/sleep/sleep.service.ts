import { Injectable } from '@nestjs/common';
import { SleepRepository } from './sleep.repository';
import {
  InvalidWellbeingRecordError,
  WellbeingDailyRecordConflictError,
  WellbeingNotFoundError,
  WellbeingRecord
} from '../wellbeing/wellbeing.types';
import {
  cleanString,
  finiteNumber,
  mergePatch,
  normalizeTemporalReference,
  recordDateFromTemporalReference,
  validTime
} from '../wellbeing/wellbeing.validation';
import {
  AWAKE_TIME_DURING_NIGHT_VALUES,
  AwakeTimeDuringNight,
  calculateSleepQuality,
  SLEEP_LATENCY_VALUES,
  SleepLatency,
  SleepQuality,
  sleepQualityClassification,
  WAKE_RESTFULNESS_VALUES,
  WakeRestfulness
} from './sleep-quality';

export type SleepPeriod = '7d' | '30d' | '1y';

@Injectable()
export class SleepService {
  constructor(private readonly repository: SleepRepository) {}

  list(userId: string) {
    return this.repository.list(userId);
  }

  async overview(input: {
    userId: string;
    period: SleepPeriod;
    page: number;
    pageSize: number;
    timezone: string;
  }) {
    const range = periodRange(input.period, input.timezone);
    const [allRecords, history] = await Promise.all([
      this.repository.listInRange(input.userId, range.startsOn, range.endsOn),
      this.repository.listPageInRange(
        input.userId,
        range.startsOn,
        range.endsOn,
        input.page,
        input.pageSize
      )
    ]);
    const firstRecordDate = allRecords.reduce<string | null>(
      (earliest, record) =>
        !earliest || record.recordDate < earliest ? record.recordDate : earliest,
      null
    );
    const trendStartsOn =
      input.period === '1y' && firstRecordDate
        ? firstRecordDate.slice(0, 7) + '-01'
        : range.startsOn;
    const buckets =
      input.period === '1y' && !firstRecordDate
        ? []
        : createBuckets(input.period, trendStartsOn, range.endsOn);
    const durationByBucket = buckets.map(() => [] as number[]);
    const qualityByBucket = buckets.map(() => [] as number[]);
    const recordCounts = buckets.map(() => 0);
    const durations: number[] = [];
    const qualityScores: number[] = [];

    for (const record of allRecords) {
      const index = buckets.findIndex(
        (bucket) => record.recordDate >= bucket.startsOn && record.recordDate <= bucket.endsOn
      );
      if (index < 0) continue;
      recordCounts[index] += 1;
      const duration = sleepDurationFromData(record.data);
      const quality = sleepQualityFromData(record.data);
      if (duration !== null) {
        durationByBucket[index].push(duration);
        durations.push(duration);
      }
      if (quality !== null) {
        qualityByBucket[index].push(quality);
        qualityScores.push(quality);
      }
    }

    return {
      period: input.period,
      range,
      summary: {
        averageDurationMinutes: averageOrNull(durations),
        averageQualityScore: averageOrNull(qualityScores),
        averageQualityClassification: qualityScores.length
          ? sleepQualityClassification(Math.round(average(qualityScores)))
          : null,
        recordCount: allRecords.length
      },
      trend: buckets.map((bucket, index) => ({
        ...bucket,
        averageDurationMinutes: averageOrNull(durationByBucket[index]),
        averageQualityScore: averageOrNull(qualityByBucket[index]),
        daysWithRecords: recordCounts[index]
      })),
      history: {
        items: history.items,
        page: input.page,
        pageSize: input.pageSize,
        totalItems: history.totalItems,
        totalPages: Math.ceil(history.totalItems / input.pageSize)
      }
    };
  }

  async createManual(input: {
    userId: string;
    clientRequestId: string;
    data: Record<string, unknown>;
    temporalReference: unknown;
  }): Promise<WellbeingRecord> {
    const temporalReference = normalizeTemporalReference(input.temporalReference);
    const provenance = { source: 'manual' as const };
    const record = await this.repository.create({
      userId: input.userId,
      recordDate: recordDateFromTemporalReference(temporalReference),
      kind: 'sleep_record',
      data: normalizeSleepData(input.data),
      temporalReference,
      provenance,
      provenanceHistory: [provenance],
      revision: 1,
      clientRequestId: input.clientRequestId,
      capturedAt: new Date()
    });
    if (!record) throw new Error('Unexpected manual sleep idempotency state');
    return record;
  }

  async createFromGuidedCheckIn(input: {
    userId: string;
    checkInId: string;
    sourceEventId: string;
    capturedAt: Date;
    timezone: string;
    localDate: string;
    data: {
      durationMinutes: number;
      wakeRestfulness: WakeRestfulness;
      awakeTimeDuringNight: AwakeTimeDuringNight;
      sleepLatency?: SleepLatency;
      sleepOnsetTime?: string;
      wakeTime?: string;
      note?: string;
    };
    promptVersion: string;
  }): Promise<WellbeingRecord> {
    const data = normalizeSleepData({
      durationMinutes: { value: input.data.durationMinutes, precision: 'exact' },
      wakeRestfulness: input.data.wakeRestfulness,
      awakeTimeDuringNight: input.data.awakeTimeDuringNight,
      ...(input.data.sleepLatency ? { sleepLatency: input.data.sleepLatency } : {}),
      ...(input.data.sleepOnsetTime
        ? { sleepOnsetTime: { value: input.data.sleepOnsetTime, precision: 'exact' } }
        : {}),
      ...(input.data.wakeTime
        ? { wakeTime: { value: input.data.wakeTime, precision: 'exact' } }
        : {}),
      ...(input.data.note ? { note: input.data.note } : {})
    });
    const confidenceByField = {
      durationMinutes: 1,
      wakeRestfulness: 1,
      awakeTimeDuringNight: 1
    };
    const provenance = {
      source: 'guided_checkin' as const,
      checkInId: input.checkInId,
      localDate: input.localDate,
      confidenceByField
    };
    let record: WellbeingRecord | null;
    try {
      record = await this.repository.create({
        userId: input.userId,
        recordDate: input.localDate,
        kind: 'sleep_record',
        data,
        temporalReference: {
          kind: 'specific_night',
          localDate: input.localDate,
          timezone: input.timezone,
          precision: 'exact'
        },
        provenance,
        provenanceHistory: [provenance],
        revision: 1,
        sessionId: input.checkInId,
        sourceEventId: input.sourceEventId,
        capturedAt: input.capturedAt,
        promptVersion: input.promptVersion
      });
    } catch (error) {
      if (!(error instanceof WellbeingDailyRecordConflictError)) throw error;
      const existing = await this.repository.findByRecordDate(input.userId, input.localDate);
      if (!existing || existing.sourceEventId !== input.sourceEventId) throw error;
      return existing;
    }
    const existing =
      record ?? (await this.repository.findBySourceEventId(input.userId, input.sourceEventId));
    if (!existing) throw new Error('Guided sleep idempotency record not found');
    return existing;
  }

  async correct(input: {
    userId: string;
    id: string;
    expectedRevision: number;
    data: Record<string, unknown>;
    temporalReference?: unknown;
  }): Promise<WellbeingRecord> {
    const current = await this.repository.findById(input.userId, input.id);
    if (!current) throw new WellbeingNotFoundError();
    const data = normalizeSleepData(mergePatch(current.data, input.data));
    const temporal = input.temporalReference
      ? normalizeTemporalReference(input.temporalReference)
      : current.temporalReference;
    const provenance = {
      source: 'manual_correction' as const,
      correctedAt: new Date().toISOString()
    };
    const updated = await this.repository.update(
      input.userId,
      input.id,
      input.expectedRevision,
      recordDateFromTemporalReference(temporal),
      data,
      temporal,
      provenance
    );
    if (!updated) throw new WellbeingNotFoundError();
    return updated;
  }

  async remove(userId: string, id: string, revision: number): Promise<void> {
    if (!(await this.repository.delete(userId, id, revision))) throw new WellbeingNotFoundError();
  }
}

export function normalizeSleepData(raw: Record<string, unknown>): Record<string, unknown> {
  const durationMinutes = preservedNumber(raw.durationMinutes, 1, 1440);
  const wakeRestfulness = enumValue(raw.wakeRestfulness, WAKE_RESTFULNESS_VALUES);
  const awakeTimeDuringNight = enumValue(raw.awakeTimeDuringNight, AWAKE_TIME_DURING_NIGHT_VALUES);
  const sleepLatency = enumValue(raw.sleepLatency, SLEEP_LATENCY_VALUES);
  const sleepOnsetTime = preservedTime(raw.sleepOnsetTime);
  const wakeTime = preservedTime(raw.wakeTime);
  const note = cleanString(raw.note, 240);

  if (
    !durationMinutes ||
    !wakeRestfulness ||
    !awakeTimeDuringNight ||
    (isProvided(raw.sleepLatency) && !sleepLatency) ||
    (isProvided(raw.sleepOnsetTime) && !sleepOnsetTime) ||
    (isProvided(raw.wakeTime) && !wakeTime)
  ) {
    throw new InvalidWellbeingRecordError();
  }

  const sleepQuality = calculateSleepQuality({
    durationMinutes: durationMinutes.value,
    wakeRestfulness,
    awakeTimeDuringNight
  });

  return {
    durationMinutes,
    wakeRestfulness,
    awakeTimeDuringNight,
    sleepQuality,
    ...(sleepLatency ? { sleepLatency } : {}),
    ...(sleepOnsetTime ? { sleepOnsetTime } : {}),
    ...(wakeTime ? { wakeTime } : {}),
    ...(note ? { note } : {})
  };
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  values: T
): T[number] | undefined {
  return typeof value === 'string' && values.includes(value) ? value : undefined;
}

function preservedNumber(value: unknown, min: number, max: number) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  const numeric = finiteNumber(item.value, min, max);
  if (
    numeric === undefined ||
    !Number.isInteger(numeric) ||
    (item.precision !== 'exact' && item.precision !== 'approximate')
  )
    return undefined;
  return { value: numeric, precision: item.precision === 'approximate' ? 'approximate' : 'exact' };
}

function preservedTime(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  const time = validTime(item.value);
  return time && (item.precision === 'exact' || item.precision === 'approximate')
    ? {
        value: time,
        precision: item.precision === 'approximate' ? 'approximate' : 'exact'
      }
    : undefined;
}

function isProvided(value: unknown) {
  return value !== undefined && value !== null;
}

function sleepDurationFromData(data: Record<string, unknown>) {
  const value = data.durationMinutes;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const minutes = (value as Record<string, unknown>).value;
  return typeof minutes === 'number' && Number.isFinite(minutes) ? minutes : null;
}

function sleepQualityFromData(data: Record<string, unknown>) {
  const value = data.sleepQuality;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const rawScore = (value as SleepQuality).rawScore;
  return typeof rawScore === 'number' &&
    Number.isFinite(rawScore) &&
    rawScore >= 0 &&
    rawScore <= 10
    ? rawScore
    : null;
}

function average(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function averageOrNull(values: readonly number[]) {
  return values.length ? average(values) : null;
}

function dateKey(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    throw new InvalidWellbeingRecordError();
  }
}

function periodRange(period: SleepPeriod, timezone: string) {
  const endsOn = dateKey(new Date(), timezone);
  const start = new Date(`${endsOn}T12:00:00.000Z`);
  if (period === '7d' || period === '30d') {
    start.setUTCDate(start.getUTCDate() - (period === '7d' ? 6 : 29));
  } else {
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() - 11);
  }
  return { startsOn: start.toISOString().slice(0, 10), endsOn };
}

function createBuckets(period: SleepPeriod, startsOn: string, endsOn: string) {
  if (period === '1y') return monthBuckets(startsOn, endsOn);
  return dayBuckets(startsOn, endsOn, period === '7d' ? 1 : 7);
}

function dayBuckets(startsOn: string, endsOn: string, daysPerBucket: number) {
  const buckets: Array<{ startsOn: string; endsOn: string }> = [];
  const end = new Date(`${endsOn}T12:00:00.000Z`);
  let cursor = new Date(`${startsOn}T12:00:00.000Z`);
  while (cursor <= end) {
    const bucketStart = new Date(cursor);
    const bucketEnd = new Date(cursor);
    bucketEnd.setUTCDate(bucketEnd.getUTCDate() + daysPerBucket - 1);
    if (bucketEnd > end) bucketEnd.setTime(end.getTime());
    buckets.push({
      startsOn: bucketStart.toISOString().slice(0, 10),
      endsOn: bucketEnd.toISOString().slice(0, 10)
    });
    cursor = new Date(bucketEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return buckets;
}

function monthBuckets(startsOn: string, endsOn: string) {
  const buckets: Array<{ startsOn: string; endsOn: string }> = [];
  const end = new Date(`${endsOn}T12:00:00.000Z`);
  let cursor = new Date(`${startsOn}T12:00:00.000Z`);
  while (cursor <= end) {
    const bucketEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0, 12));
    if (bucketEnd > end) bucketEnd.setTime(end.getTime());
    buckets.push({
      startsOn: cursor.toISOString().slice(0, 10),
      endsOn: bucketEnd.toISOString().slice(0, 10)
    });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1, 12));
  }
  return buckets;
}
