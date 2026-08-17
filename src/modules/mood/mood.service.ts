import { Injectable } from '@nestjs/common';
import { MoodRepository } from './mood.repository';
import {
  InvalidWellbeingRecordError,
  WellbeingNotFoundError,
  WellbeingRecord
} from '../wellbeing/wellbeing.types';
import {
  cleanString,
  cleanStringArray,
  finiteNumber,
  mergePatch,
  normalizeTemporalReference
} from '../wellbeing/wellbeing.validation';

@Injectable()
export class MoodService {
  constructor(private readonly repository: MoodRepository) {}

  list(userId: string, kinds?: string[]) {
    return this.repository.list(userId, kinds);
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
    const provenance = { source: 'manual' as const };
    const record = await this.repository.create({
      userId: input.userId,
      kind: input.kind,
      data,
      temporalReference: normalizeTemporalReference(input.temporalReference),
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
    const record = await this.repository.create({
      userId: input.userId,
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
  if (moodScore !== undefined && !Number.isInteger(moodScore)) {
    throw new InvalidWellbeingRecordError();
  }
  const intensityDescriptor = cleanString(raw.intensityDescriptor, 80);
  if (
    !primaryEmotion &&
    !descriptors.length &&
    !explicitRating &&
    !explicitIntensity &&
    intensity === undefined &&
    moodScore === undefined
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
    ...(intensityDescriptor ? { intensityDescriptor } : {}),
    ...(explicitRating ? { explicitRating } : {}),
    ...(explicitIntensity ? { explicitIntensity } : {}),
    ...(intensity === undefined ? {} : { intensity }),
    ...(energy === undefined ? {} : { energy }),
    ...(valence === undefined ? {} : { valence }),
    ...(moodScore === undefined ? {} : { moodScore }),
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
