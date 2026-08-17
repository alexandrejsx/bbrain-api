import { Injectable } from '@nestjs/common';
import { SleepRepository } from './sleep.repository';
import {
  InvalidWellbeingRecordError,
  TemporalReference,
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

  async createFromChat(input: {
    userId: string;
    sessionId: string;
    sourceEventId: string;
    capturedAt: Date;
    timezone: string;
    confidence: number;
    data: {
      durationMinutes: number | null;
      durationMinMinutes: number | null;
      durationMaxMinutes: number | null;
      bedtime: string | null;
      wakeTime: string | null;
      quality: string | null;
      awakenings: number | null;
      wakeFeeling: string | null;
      date: string | null;
      period: string | null;
      precision: 'exact' | 'approximate';
    };
    extractorVersion: string;
    promptVersion: string;
  }): Promise<void> {
    const preserved = <T>(value: T) => ({ value, precision: input.data.precision });
    const data = normalizeSleepData({
      ...(input.data.durationMinutes === null
        ? {}
        : { durationMinutes: preserved(input.data.durationMinutes) }),
      ...(input.data.durationMinMinutes === null || input.data.durationMaxMinutes === null
        ? {}
        : {
            durationMinutesRange: {
              min: input.data.durationMinMinutes,
              max: input.data.durationMaxMinutes,
              precision: input.data.precision
            }
          }),
      ...(input.data.bedtime ? { bedtime: preserved(input.data.bedtime) } : {}),
      ...(input.data.wakeTime ? { wakeTime: preserved(input.data.wakeTime) } : {}),
      ...(input.data.quality ? { quality: preserved(input.data.quality) } : {}),
      ...(input.data.awakenings === null
        ? {}
        : { awakeningCount: preserved(input.data.awakenings) }),
      ...(input.data.wakeFeeling ? { wakeFeeling: preserved(input.data.wakeFeeling) } : {})
    });
    const provenance = {
      source: 'conversation_extraction' as const,
      sourceMessageId: input.sourceEventId,
      conversationId: input.sessionId,
      confidence: input.confidence
    };
    await this.repository.create({
      userId: input.userId,
      kind: 'sleep_record',
      data,
      temporalReference: automaticTemporal(
        input.data.date,
        input.data.period,
        input.data.precision,
        input.timezone
      ),
      provenance,
      provenanceHistory: [provenance],
      revision: 1,
      sessionId: input.sessionId,
      sourceEventId: input.sourceEventId,
      capturedAt: input.capturedAt,
      extractorVersion: input.extractorVersion,
      promptVersion: input.promptVersion
    });
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
  const duration = preservedNumber(raw.durationMinutes, 1, 1440, true);
  const range = preservedRange(raw.durationMinutesRange, 1, 1440);
  if (duration && range) throw new InvalidWellbeingRecordError();
  const quality = preservedString(raw.quality, 60);
  const bedtime = preservedTime(raw.bedtime);
  const wakeTime = preservedTime(raw.wakeTime);
  const awakeningCount = preservedNumber(raw.awakeningCount, 0, 100, true);
  const wakeFeeling = preservedString(raw.wakeFeeling, 60);
  if (!duration && !range && !quality && !bedtime && !wakeTime && !awakeningCount && !wakeFeeling) {
    throw new InvalidWellbeingRecordError();
  }
  return {
    ...(duration ? { durationMinutes: duration } : {}),
    ...(range ? { durationMinutesRange: range } : {}),
    ...(quality ? { quality } : {}),
    ...(bedtime ? { bedtime } : {}),
    ...(wakeTime ? { wakeTime } : {}),
    ...(awakeningCount ? { awakeningCount } : {}),
    ...(wakeFeeling ? { wakeFeeling } : {})
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

function automaticTemporal(
  date: string | null,
  period: string | null,
  precision: 'exact' | 'approximate',
  timezone: string
): TemporalReference {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { kind: 'specific_night', localDate: date, timezone, precision };
  }
  if (period?.trim()) {
    return { kind: 'period', descriptor: period.trim().slice(0, 120), timezone, precision };
  }
  return { kind: 'unknown', timezone };
}
