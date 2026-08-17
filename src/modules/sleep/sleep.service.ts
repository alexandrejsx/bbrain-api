import { Injectable } from '@nestjs/common';
import { SleepRepository } from './sleep.repository';
import {
  InvalidWellbeingRecordError,
  WellbeingNotFoundError,
  WellbeingRecord
} from '../wellbeing/wellbeing.types';
import {
  cleanString,
  finiteNumber,
  mergePatch,
  normalizeTemporalReference,
  validTime
} from '../wellbeing/wellbeing.validation';

@Injectable()
export class SleepService {
  constructor(private readonly repository: SleepRepository) {}

  list(userId: string) {
    return this.repository.list(userId);
  }

  async createManual(input: {
    userId: string;
    clientRequestId: string;
    data: Record<string, unknown>;
    temporalReference: unknown;
  }): Promise<WellbeingRecord> {
    const now = new Date();
    const provenance = { source: 'manual' as const };
    const record = await this.repository.create({
      userId: input.userId,
      kind: 'sleep_record',
      data: normalizeSleepData(input.data),
      temporalReference: normalizeTemporalReference(input.temporalReference),
      provenance,
      provenanceHistory: [provenance],
      revision: 1,
      clientRequestId: input.clientRequestId,
      capturedAt: now
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
      durationMinutes: number | null;
      durationConfidence: number | null;
      durationApproximate: boolean;
      subjectiveQualityScore: number | null;
      subjectiveQualityConfidence: number | null;
      awakeningsCount: number | null;
      awakeningsConfidence: number | null;
      awakeningsApproximate: boolean;
      multipleAwakenings: boolean;
      awakeDuringNightMinutes: number | null;
      awakeDuringNightConfidence: number | null;
      awakeDuringNightApproximate: boolean;
      restfulnessScore: number | null;
      restfulnessConfidence: number | null;
      note: string | null;
    };
    promptVersion: string;
  }): Promise<WellbeingRecord> {
    const preserved = <T>(value: T, approximate: boolean) => ({
      value,
      precision: approximate ? 'approximate' : 'exact'
    });
    const data = normalizeSleepData({
      ...(input.data.durationMinutes === null
        ? {}
        : {
            durationMinutes: preserved(input.data.durationMinutes, input.data.durationApproximate)
          }),
      ...(input.data.subjectiveQualityScore === null
        ? {}
        : { subjectiveQualityScore: input.data.subjectiveQualityScore }),
      ...(input.data.awakeningsCount === null
        ? {}
        : {
            awakeningCount: preserved(input.data.awakeningsCount, input.data.awakeningsApproximate)
          }),
      ...(input.data.multipleAwakenings ? { multipleAwakenings: true } : {}),
      ...(input.data.awakeDuringNightMinutes === null
        ? {}
        : {
            awakeDuringNightMinutes: preserved(
              input.data.awakeDuringNightMinutes,
              input.data.awakeDuringNightApproximate
            )
          }),
      ...(input.data.restfulnessScore === null
        ? {}
        : { restfulnessScore: input.data.restfulnessScore }),
      ...(input.data.note ? { note: input.data.note } : {})
    });
    const confidenceByField = Object.fromEntries(
      [
        ['durationMinutes', input.data.durationConfidence],
        ['subjectiveQualityScore', input.data.subjectiveQualityConfidence],
        ['awakeningsCount', input.data.awakeningsConfidence],
        ['awakeDuringNightMinutes', input.data.awakeDuringNightConfidence],
        ['restfulnessScore', input.data.restfulnessConfidence]
      ].filter((item): item is [string, number] => typeof item[1] === 'number')
    );
    const provenance = {
      source: 'guided_checkin' as const,
      checkInId: input.checkInId,
      localDate: input.localDate,
      confidenceByField
    };
    const record = await this.repository.create({
      userId: input.userId,
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

function normalizeSleepData(raw: Record<string, unknown>): Record<string, unknown> {
  const duration = preservedNumber(raw.durationMinutes, 0, 1440, true);
  const range = preservedRange(raw.durationMinutesRange, 0, 1440);
  if (duration && range) throw new InvalidWellbeingRecordError();
  const quality = preservedString(raw.quality, 60);
  const bedtime = preservedTime(raw.bedtime);
  const wakeTime = preservedTime(raw.wakeTime);
  const awakeningCount = preservedNumber(raw.awakeningCount, 0, 100, true);
  const wakeFeeling = preservedString(raw.wakeFeeling, 60);
  const subjectiveQualityScore = integer(raw.subjectiveQualityScore, 0, 10);
  const awakeDuringNightMinutes = preservedNumber(raw.awakeDuringNightMinutes, 0, 1440, true);
  const restfulnessScore = integer(raw.restfulnessScore, 0, 10);
  const multipleAwakenings = raw.multipleAwakenings === true;
  const note = cleanString(raw.note, 240);
  if (
    !duration &&
    !range &&
    !quality &&
    !bedtime &&
    !wakeTime &&
    !awakeningCount &&
    !wakeFeeling &&
    subjectiveQualityScore === undefined &&
    !awakeDuringNightMinutes &&
    restfulnessScore === undefined &&
    !multipleAwakenings
  ) {
    throw new InvalidWellbeingRecordError();
  }
  return {
    ...(duration ? { durationMinutes: duration } : {}),
    ...(range ? { durationMinutesRange: range } : {}),
    ...(quality ? { quality } : {}),
    ...(bedtime ? { bedtime } : {}),
    ...(wakeTime ? { wakeTime } : {}),
    ...(awakeningCount ? { awakeningCount } : {}),
    ...(wakeFeeling ? { wakeFeeling } : {}),
    ...(subjectiveQualityScore === undefined ? {} : { subjectiveQualityScore }),
    ...(awakeDuringNightMinutes ? { awakeDuringNightMinutes } : {}),
    ...(restfulnessScore === undefined ? {} : { restfulnessScore }),
    ...(multipleAwakenings ? { multipleAwakenings: true } : {}),
    ...(note ? { note } : {})
  };
}

function preservedNumber(value: unknown, min: number, max: number, integer: boolean) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  const numeric = finiteNumber(item.value, min, max);
  if (numeric === undefined || (integer && !Number.isInteger(numeric))) return undefined;
  return { value: numeric, precision: item.precision === 'approximate' ? 'approximate' : 'exact' };
}

function preservedRange(value: unknown, min: number, max: number) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  const minimum = finiteNumber(item.min, min, max);
  const maximum = finiteNumber(item.max, min, max);
  if (
    minimum === undefined ||
    maximum === undefined ||
    !Number.isInteger(minimum) ||
    !Number.isInteger(maximum) ||
    maximum <= minimum
  )
    return undefined;
  return {
    min: minimum,
    max: maximum,
    precision: item.precision === 'approximate' ? 'approximate' : 'exact'
  };
}

function preservedString(value: unknown, maxLength: number) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  const text = cleanString(item.value, maxLength);
  return text
    ? { value: text, precision: item.precision === 'approximate' ? 'approximate' : 'exact' }
    : undefined;
}

function preservedTime(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  const time = validTime(item.value);
  return time
    ? { value: time, precision: item.precision === 'approximate' ? 'approximate' : 'exact' }
    : undefined;
}

function integer(value: unknown, min: number, max: number): number | undefined {
  const numeric = finiteNumber(value, min, max);
  return numeric !== undefined && Number.isInteger(numeric) ? numeric : undefined;
}
