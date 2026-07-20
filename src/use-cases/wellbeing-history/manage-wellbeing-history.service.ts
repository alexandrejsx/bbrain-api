import { randomUUID } from 'node:crypto';
import { DomainEvent } from '../../domain/core/domain-event';
import { EventDispatcher } from '../../domain/core/event-dispatcher';
import { WellbeingObservation } from '../../domain/wellbeing-history/entities/wellbeing-observation.entity';
import {
  WellbeingObservationListCriteria,
  WellbeingObservationRepository
} from '../../domain/wellbeing-history/repositories/wellbeing-observation.repository';
import {
  ManualWellbeingObservationCorrection,
  MoodDailySummaryData,
  TemporalReference,
  WellbeingObservationDataByKind,
  WellbeingObservationKind,
  WELLBEING_OBSERVATION_KINDS
} from '../../domain/wellbeing-history/value-objects/wellbeing-observation.types';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import {
  normalizeTimezone,
  parseManualTemporalReference
} from './wellbeing-observation-input.mapper';
import {
  DailyMoodSummaryProjectorService,
  MAX_DERIVED_MOOD_SOURCE_EVENTS,
  moodProjectionDateForTemporal
} from './daily-mood-summary-projector.service';
import { applyWellbeingObservationMergePatch } from './wellbeing-observation-data-patch';

export class WellbeingObservationNotFoundError extends Error {
  constructor() {
    super('Wellbeing observation not found');
    this.name = 'WellbeingObservationNotFoundError';
  }
}

export class WellbeingObservationRevisionConflictError extends Error {
  constructor() {
    super('Wellbeing observation revision does not match');
    this.name = 'WellbeingObservationRevisionConflictError';
  }
}

export class InvalidWellbeingObservationError extends Error {
  constructor(message = 'Invalid wellbeing observation') {
    super(message);
    this.name = 'InvalidWellbeingObservationError';
  }
}

export class WellbeingObservationIdempotencyConflictError extends Error {
  constructor() {
    super('Client request id was already used for different wellbeing data');
    this.name = 'WellbeingObservationIdempotencyConflictError';
  }
}

export interface CreateManualWellbeingObservationInput {
  userId: string;
  clientRequestId?: string;
  kind: WellbeingObservationKind;
  data: unknown;
  temporalReference: unknown;
}

export interface CorrectManualWellbeingObservationInput {
  userId: string;
  observationId: string;
  expectedRevision: number;
  data: unknown;
  temporalReference?: unknown;
}

function isKind(value: unknown): value is WellbeingObservationKind {
  return WELLBEING_OBSERVATION_KINDS.includes(value as WellbeingObservationKind);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalize(nested)])
  );
}

function hasSameCreatePayload(
  current: WellbeingObservation,
  candidate: WellbeingObservation
): boolean {
  return (
    current.kind === candidate.kind &&
    JSON.stringify(canonicalize(current.data)) === JSON.stringify(canonicalize(candidate.data)) &&
    JSON.stringify(canonicalize(current.temporalReference)) ===
      JSON.stringify(canonicalize(candidate.temporalReference))
  );
}

function prepareManualCreateData(
  kind: WellbeingObservationKind,
  data: unknown
): WellbeingObservationDataByKind[WellbeingObservationKind] {
  if (kind !== 'mood_daily_summary') {
    return data as WellbeingObservationDataByKind[typeof kind];
  }
  if (!isRecord(data)) return data as MoodDailySummaryData;

  return {
    ...data,
    sourceObservationIds: [],
    sourceObservationVersions: [],
    coverage:
      data.coverage === 'partial' || data.coverage === 'sufficient' ? data.coverage : 'unknown',
    status: 'current',
    summarySource: 'manual_override'
  };
}

function prepareManualCorrection(
  observation: WellbeingObservation,
  data: unknown,
  temporalReference: TemporalReference | undefined
): ManualWellbeingObservationCorrection {
  const mergedData = applyWellbeingObservationMergePatch(observation.data, data);
  const correctionData =
    observation.kind === 'mood_daily_summary' && isRecord(mergedData)
      ? {
          ...mergedData,
          sourceObservationIds: (observation.data as MoodDailySummaryData).sourceObservationIds,
          sourceObservationVersions: (observation.data as MoodDailySummaryData)
            .sourceObservationVersions,
          coverage:
            mergedData.coverage === 'partial' ||
            mergedData.coverage === 'sufficient' ||
            mergedData.coverage === 'unknown'
              ? mergedData.coverage
              : (observation.data as MoodDailySummaryData).coverage
        }
      : mergedData;

  return {
    kind: observation.kind,
    data: correctionData as ManualWellbeingObservationCorrection['data'],
    ...(temporalReference ? { temporalReference } : {})
  };
}

function asMoodDailySummaryData(
  observation: WellbeingObservation
): MoodDailySummaryData | undefined {
  return observation.kind === 'mood_daily_summary'
    ? (observation.data as MoodDailySummaryData)
    : undefined;
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

export class ManageWellbeingHistoryService {
  constructor(
    private readonly repository: WellbeingObservationRepository,
    private readonly userRepository: UserRepository,
    private readonly eventDispatcher: EventDispatcher,
    private readonly moodProjector: DailyMoodSummaryProjectorService
  ) {}

  async list(userId: string, criteria?: WellbeingObservationListCriteria) {
    const observations = await this.repository.list(userId, criteria);
    const needsSourceValidation = observations.some((observation) => {
      const summary = asMoodDailySummaryData(observation);
      return summary?.summarySource === 'derived' && summary.status === 'current';
    });
    if (!needsSourceValidation) return observations;

    const moodEvents = await this.repository.list(userId, { kinds: ['mood_event'] });
    const moodEventsById = new Map(moodEvents.map((event) => [event.id.value, event]));
    const sourceEventsByDate = new Map<string, WellbeingObservation[]>();
    for (const event of moodEvents) {
      const localDate = moodProjectionDateForTemporal(event.temporalReference);
      if (!localDate) continue;
      const current = sourceEventsByDate.get(localDate) ?? [];
      if (current.length < MAX_DERIVED_MOOD_SOURCE_EVENTS) current.push(event);
      sourceEventsByDate.set(localDate, current);
    }

    return observations.filter((observation) => {
      const summary = asMoodDailySummaryData(observation);
      if (!summary || summary.summarySource !== 'derived' || summary.status !== 'current') {
        return true;
      }

      const versions = summary.sourceObservationVersions;
      const localDate = moodProjectionDateForTemporal(observation.temporalReference);
      const eligibleSourceIds = localDate
        ? (sourceEventsByDate.get(localDate) ?? []).map((event) => event.id.value)
        : [];
      return Boolean(
        localDate &&
        sameIds(summary.sourceObservationIds, eligibleSourceIds) &&
        versions?.length &&
        versions.every(
          (source) => moodEventsById.get(source.observationId)?.revision === source.revision
        )
      );
    });
  }

  async createManual(input: CreateManualWellbeingObservationInput) {
    if (!isKind(input.kind)) throw new Error('Invalid wellbeing observation kind');

    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new WellbeingObservationNotFoundError();
    const timezone = normalizeTimezone(user.timezone);
    const idempotencyKey = `manual:${input.clientRequestId?.trim() || randomUUID()}`;
    let observation: WellbeingObservation;

    try {
      observation = WellbeingObservation.create({
        userId: input.userId,
        idempotencyKey,
        kind: input.kind,
        data: prepareManualCreateData(input.kind, input.data),
        temporalReference: parseManualTemporalReference(input.temporalReference, timezone),
        provenance: { source: 'manual' }
      });
    } catch (error) {
      throw new InvalidWellbeingObservationError(
        error instanceof Error ? error.message : undefined
      );
    }
    const events = observation.pullDomainEvents();
    const result = await this.repository.saveIfAbsent(input.userId, idempotencyKey, observation);

    if (!result.created && !hasSameCreatePayload(result.observation, observation)) {
      throw new WellbeingObservationIdempotencyConflictError();
    }

    if (result.created) await this.eventDispatcher.dispatch(events);
    if (result.created) await this.moodProjector.refreshAfter(result.observation);
    return result.observation;
  }

  async correctManually(input: CorrectManualWellbeingObservationInput) {
    const observation = await this.requireObservation(input.userId, input.observationId);
    if (observation.revision !== input.expectedRevision) {
      throw new WellbeingObservationRevisionConflictError();
    }

    const previousTemporalReference = observation.temporalReference;
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new WellbeingObservationNotFoundError();
    let temporalReference: TemporalReference | undefined;

    try {
      temporalReference =
        input.temporalReference === undefined
          ? undefined
          : parseManualTemporalReference(input.temporalReference, normalizeTimezone(user.timezone));
      observation.correctManually(
        prepareManualCorrection(observation, input.data, temporalReference),
        new Date()
      );
    } catch (error) {
      throw new InvalidWellbeingObservationError(
        error instanceof Error ? error.message : undefined
      );
    }

    try {
      await this.repository.update(input.userId, observation);
    } catch (error) {
      if (error instanceof Error && error.name === 'WellbeingObservationConcurrencyError') {
        throw new WellbeingObservationRevisionConflictError();
      }
      throw error;
    }
    const events = observation.pullDomainEvents();
    const staleEvents = await this.invalidateDependentMoodSummaries(
      observation,
      'source_observation_corrected'
    );
    await this.eventDispatcher.dispatch([...events, ...staleEvents]);
    await this.moodProjector.refreshAfter(observation, previousTemporalReference);
    return observation;
  }

  async remove(userId: string, observationId: string, expectedRevision: number): Promise<void> {
    const observation = await this.requireObservation(userId, observationId);
    if (observation.revision !== expectedRevision) {
      throw new WellbeingObservationRevisionConflictError();
    }

    const removed = await this.repository.delete(userId, observationId, expectedRevision);
    if (!removed) throw new WellbeingObservationRevisionConflictError();

    const staleEvents = await this.invalidateDependentMoodSummaries(
      observation,
      'source_observation_removed'
    );
    observation.markRemoved();
    const events = observation.pullDomainEvents();
    await this.eventDispatcher.dispatch([...staleEvents, ...events]);
    const removedSummary = asMoodDailySummaryData(observation);
    if (
      observation.kind === 'mood_event' ||
      (observation.kind === 'mood_daily_summary' && removedSummary?.summarySource !== 'derived')
    ) {
      await this.moodProjector.refreshAfter(observation);
    }
  }

  private async requireObservation(userId: string, observationId: string) {
    const observation = await this.repository.findById(userId, observationId);
    if (!observation) throw new WellbeingObservationNotFoundError();
    return observation;
  }

  private async invalidateDependentMoodSummaries(
    observation: WellbeingObservation,
    reason: string
  ) {
    if (observation.kind !== 'mood_event') return [];

    const summaries = await this.repository.findMoodSummariesBySourceObservation(
      observation.userId,
      observation.id.value
    );
    const events: DomainEvent[] = [];

    for (const summary of summaries) {
      if (!summary.markStale(reason)) continue;
      await this.repository.update(observation.userId, summary);
      events.push(...summary.pullDomainEvents());
    }

    return events;
  }
}
