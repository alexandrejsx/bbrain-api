import { Injectable } from '@nestjs/common';
import { MoodRepository } from './mood.repository';
import {
  InvalidWellbeingRecordError,
  WellbeingDailyRecordConflictError,
  WellbeingNotFoundError,
  WellbeingRecord
} from '../wellbeing/wellbeing.types';
import {
  cleanString,
  cleanStringArray,
  finiteNumber,
  mergePatch,
  normalizeTemporalReference,
  recordDateFromTemporalReference
} from '../wellbeing/wellbeing.validation';
import {
  isMoodLevel,
  MoodLevel,
  moodLevelFromScore,
  MoodPeriod,
  moodScoreFromData,
  representativeMoodScore
} from './mood-level';

type MoodBucket = {
  startsOn: string;
  endsOn: string;
  level: MoodLevel | null;
  recordCount: number;
};

@Injectable()
export class MoodService {
  constructor(private readonly repository: MoodRepository) {}

  list(userId: string, kinds?: string[]) {
    return this.repository.list(userId, kinds);
  }

  async overview(input: {
    userId: string;
    period: MoodPeriod;
    page: number;
    pageSize: number;
    timezone: string;
  }) {
    const range = moodPeriodRange(input.period, input.timezone);
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
    const buckets = createBuckets(input.period, range.startsOn, range.endsOn);
    const scoresByBucket = buckets.map(() => [] as number[]);
    const recordCountsByBucket = buckets.map(() => 0);
    const allScores: number[] = [];

    for (const record of allRecords) {
      const score = moodScoreFromData(record.data);
      const bucketIndex = buckets.findIndex(
        (bucket) => record.recordDate >= bucket.startsOn && record.recordDate <= bucket.endsOn
      );
      if (bucketIndex < 0) continue;
      recordCountsByBucket[bucketIndex] += 1;
      if (score === null) continue;
      scoresByBucket[bucketIndex].push(score);
      allScores.push(score);
    }

    const trend: MoodBucket[] = buckets.map((bucket, index) => {
      const scores = scoresByBucket[index];
      return {
        ...bucket,
        level: scores.length ? moodLevelFromScore(average(scores)) : null,
        recordCount: recordCountsByBucket[index]
      };
    });

    return {
      period: input.period,
      range,
      summary: {
        level: allScores.length ? moodLevelFromScore(average(allScores)) : null,
        recordCount: allRecords.length
      },
      trend,
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
    kind: 'mood_event' | 'mood_daily_summary';
    data: Record<string, unknown>;
    temporalReference: unknown;
  }): Promise<WellbeingRecord> {
    const now = new Date();
    const data = normalizeMoodData(input.data, input.kind);
    const temporalReference = normalizeTemporalReference(input.temporalReference);
    const provenance = { source: 'manual' as const };
    const record = await this.repository.create({
      userId: input.userId,
      recordDate: recordDateFromTemporalReference(temporalReference),
      kind: input.kind,
      data,
      temporalReference,
      provenance,
      provenanceHistory: [provenance],
      revision: 1,
      clientRequestId: input.clientRequestId,
      capturedAt: now
    });
    if (!record) throw new Error('Unexpected manual mood idempotency state');
    return record;
  }

  async createFromGuidedCheckIn(input: {
    userId: string;
    checkInId: string;
    sourceEventId: string;
    capturedAt: Date;
    timezone: string;
    localDate: string;
    score: number;
    scoreConfidence: number;
    note: string | null;
    promptVersion: string;
  }): Promise<WellbeingRecord> {
    const data = normalizeMoodData({ moodScore: input.score, note: input.note }, 'mood_event');
    const provenance = {
      source: 'guided_checkin' as const,
      checkInId: input.checkInId,
      localDate: input.localDate,
      confidenceByField: { moodScore: input.scoreConfidence }
    };
    let record: WellbeingRecord | null;
    try {
      record = await this.repository.create({
        userId: input.userId,
        recordDate: input.localDate,
        kind: 'mood_event',
        data,
        temporalReference: {
          kind: 'specific_day',
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
      if (!existing) throw error;
      return existing;
    }
    const existing =
      record ?? (await this.repository.findBySourceEventId(input.userId, input.sourceEventId));
    if (!existing) throw new Error('Guided mood idempotency record not found');
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
    const data = normalizeMoodData(mergePatch(current.data, input.data), current.kind as never);
    const temporal = input.temporalReference
      ? normalizeTemporalReference(input.temporalReference)
      : current.temporalReference;
    const recordDate = recordDateFromTemporalReference(temporal);
    const provenance = {
      source: 'manual_correction' as const,
      correctedAt: new Date().toISOString()
    };
    const updated = await this.repository.update(
      input.userId,
      input.id,
      input.expectedRevision,
      recordDate,
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

function normalizeMoodData(
  raw: Record<string, unknown>,
  kind: 'mood_event' | 'mood_daily_summary'
): Record<string, unknown> {
  const descriptors = cleanStringArray(raw.descriptors, 12, 80);
  const primaryEmotion = cleanString(raw.primaryEmotion, 60) ?? descriptors[0];
  const secondaryEmotions = cleanStringArray(raw.secondaryEmotions, 4, 60);
  const explicitRating = normalizeRating(raw.explicitRating);
  const explicitIntensity = normalizeRating(raw.explicitIntensity);
  const intensity = finiteNumber(raw.intensity, 0, 10);
  const energy = finiteNumber(raw.energy, 0, 10);
  const valence = finiteNumber(raw.valence, -1, 1);
  const moodScore = finiteNumber(raw.moodScore, 0, 10);
  const moodLevel = isMoodLevel(raw.moodLevel) ? raw.moodLevel : undefined;
  const compatibleMoodScore = moodLevel ? representativeMoodScore(moodLevel) : moodScore;
  const intensityDescriptor = cleanString(raw.intensityDescriptor, 80);
  if (
    !primaryEmotion &&
    !descriptors.length &&
    !explicitRating &&
    !explicitIntensity &&
    intensity === undefined &&
    compatibleMoodScore === undefined
  ) {
    throw new InvalidWellbeingRecordError();
  }
  return {
    ...(primaryEmotion ? { primaryEmotion } : {}),
    ...(secondaryEmotions.length ? { secondaryEmotions } : {}),
    ...(descriptors.length
      ? { descriptors }
      : primaryEmotion
        ? { descriptors: [primaryEmotion] }
        : {}),
    ...(raw.isMixed === true ? { isMixed: true } : {}),
    ...(raw.isUnstable === true ? { isUnstable: true } : {}),
    ...(intensityDescriptor ? { intensityDescriptor } : {}),
    ...(explicitRating ? { explicitRating } : {}),
    ...(explicitIntensity ? { explicitIntensity } : {}),
    ...(intensity === undefined ? {} : { intensity }),
    ...(energy === undefined ? {} : { energy }),
    ...(valence === undefined ? {} : { valence }),
    ...(moodLevel ? { moodLevel } : {}),
    ...(compatibleMoodScore === undefined ? {} : { moodScore: compatibleMoodScore }),
    ...(cleanString(raw.note, 240) ? { note: cleanString(raw.note, 240) } : {}),
    ...(cleanString(raw.context, 180) ? { context: cleanString(raw.context, 180) } : {}),
    ...(kind === 'mood_daily_summary'
      ? {
          sourceObservationIds: Array.isArray(raw.sourceObservationIds)
            ? cleanStringArray(raw.sourceObservationIds, 50, 80)
            : [],
          coverage:
            raw.coverage === 'sufficient' || raw.coverage === 'partial' ? raw.coverage : 'unknown',
          status: 'current',
          summarySource: 'manual_override'
        }
      : {})
  };
}

function average(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function formatDateKey(date: Date, timezone: string) {
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

function moodPeriodRange(period: MoodPeriod, timezone: string) {
  const endsOn = formatDateKey(new Date(), timezone);
  const end = new Date(`${endsOn}T12:00:00.000Z`);
  const start = new Date(end);

  if (period === '7d' || period === '30d') {
    start.setUTCDate(start.getUTCDate() - (period === '7d' ? 6 : 29));
  } else {
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() - 11);
  }

  return { startsOn: start.toISOString().slice(0, 10), endsOn };
}

function createBuckets(period: MoodPeriod, startsOn: string, endsOn: string): MoodBucket[] {
  if (period === '1y') return createMonthBuckets(startsOn, endsOn);
  return createDayBuckets(startsOn, endsOn, period === '7d' ? 1 : 7);
}

function createDayBuckets(startsOn: string, endsOn: string, daysPerBucket: number): MoodBucket[] {
  const buckets: MoodBucket[] = [];
  const end = new Date(`${endsOn}T12:00:00.000Z`);
  let cursor = new Date(`${startsOn}T12:00:00.000Z`);

  while (cursor <= end) {
    const bucketStart = new Date(cursor);
    const bucketEnd = new Date(cursor);
    bucketEnd.setUTCDate(bucketEnd.getUTCDate() + daysPerBucket - 1);
    if (bucketEnd > end) bucketEnd.setTime(end.getTime());
    buckets.push({
      startsOn: bucketStart.toISOString().slice(0, 10),
      endsOn: bucketEnd.toISOString().slice(0, 10),
      level: null,
      recordCount: 0
    });
    cursor = new Date(bucketEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return buckets;
}

function createMonthBuckets(startsOn: string, endsOn: string): MoodBucket[] {
  const buckets: MoodBucket[] = [];
  const end = new Date(`${endsOn}T12:00:00.000Z`);
  let cursor = new Date(`${startsOn}T12:00:00.000Z`);

  while (cursor <= end) {
    const bucketStart = new Date(cursor);
    const bucketEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0, 12));
    if (bucketEnd > end) bucketEnd.setTime(end.getTime());
    buckets.push({
      startsOn: bucketStart.toISOString().slice(0, 10),
      endsOn: bucketEnd.toISOString().slice(0, 10),
      level: null,
      recordCount: 0
    });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1, 12));
  }
  return buckets;
}

function normalizeRating(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const rating = value as Record<string, unknown>;
  const max = finiteNumber(rating.scaleMax, 1, 100);
  const min = rating.scaleMin === undefined ? undefined : finiteNumber(rating.scaleMin, -100, 99);
  if (
    max === undefined ||
    typeof rating.value !== 'number' ||
    rating.value > max ||
    (min !== undefined && rating.value < min)
  ) {
    return undefined;
  }
  return { value: rating.value, ...(min === undefined ? {} : { scaleMin: min }), scaleMax: max };
}
