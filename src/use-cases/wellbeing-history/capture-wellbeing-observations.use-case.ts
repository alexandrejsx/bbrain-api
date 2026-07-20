import { createHash } from 'node:crypto';
import { DomainEvent } from '../../domain/core/domain-event';
import { EventDispatcher } from '../../domain/core/event-dispatcher';
import { UsageService } from '../../domain/usage/services/usage.service';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import { WellbeingObservation } from '../../domain/wellbeing-history/entities/wellbeing-observation.entity';
import { WellbeingCandidateValidationPolicy } from '../../domain/wellbeing-history/services/wellbeing-candidate-validation.policy';
import { WellbeingObservationRepository } from '../../domain/wellbeing-history/repositories/wellbeing-observation.repository';
import {
  ConversationExtractionProvenance,
  ConversationCorrectionProvenance,
  MoodDailySummaryData,
  MoodEventData,
  SleepRecordData
} from '../../domain/wellbeing-history/value-objects/wellbeing-observation.types';
import {
  validateTemporalReference,
  validateWellbeingObservationData
} from '../../domain/wellbeing-history/value-objects/wellbeing-observation.validators';
import {
  ObservationExtractionRequest,
  ObservationExtractor,
  RecentStructuredObservation
} from './ports/observation-extractor.port';
import { normalizeTimezone, toDomainCandidate } from './wellbeing-observation-input.mapper';
import { DailyMoodSummaryProjectorService } from './daily-mood-summary-projector.service';
import { applyWellbeingObservationMergePatch } from './wellbeing-observation-data-patch';
import { SensitiveTextFingerprintPort } from '../conversation/ports/sensitive-text-fingerprint.port';

export interface CaptureWellbeingObservationsInput {
  userId: string;
  conversationId: string;
  sourceMessageId: string;
  currentUserMessage: string;
  timezone: string;
  allowAutomaticCapture: boolean;
  referenceAt?: Date;
}

export interface CaptureWellbeingObservationsOutput {
  status: 'captured' | 'shadow_evaluated' | 'skipped_by_policy' | 'skipped_user_unavailable';
  extracted: number;
  accepted: number;
  created: number;
  corrected: number;
  wouldCreate: number;
  wouldCorrect: number;
  rejected: number;
  deduplicated: number;
}

function toRecentStructuredObservation(
  observation: WellbeingObservation
): RecentStructuredObservation | undefined {
  const source = observation.provenanceHistory.find(
    (entry) => entry.source === 'conversation_extraction'
  );
  if (!source || source.source !== 'conversation_extraction') {
    return undefined;
  }

  const temporal = observation.temporalReference;
  const mappedTemporal = (() => {
    switch (temporal.kind) {
      case 'moment':
        return {
          scope: 'moment' as const,
          precision: temporal.precision,
          startAt: temporal.at.toISOString()
        };
      case 'specific_day':
        return {
          scope: 'day' as const,
          precision: temporal.precision,
          startAt: temporal.localDate
        };
      case 'specific_night':
        return {
          scope: 'night' as const,
          precision: temporal.precision,
          startAt: temporal.localDate
        };
      case 'interval':
        return {
          scope: 'interval' as const,
          precision: temporal.precision,
          startAt: temporal.startsAt.toISOString(),
          endAt: temporal.endsAt.toISOString()
        };
      case 'period':
        return {
          scope: 'ongoing_period' as const,
          precision: temporal.precision,
          startAt: temporal.startsOn,
          endAt: temporal.endsOn,
          originalExpression: temporal.descriptor
        };
      default:
        return { scope: 'unknown' as const, precision: 'unknown' as const };
    }
  })();

  if (observation.kind === 'sleep_record') {
    const sleep = observation.data as SleepRecordData;
    return {
      observationId: observation.id.value,
      sourceMessageId: source.sourceMessageId,
      kind: 'sleep_record',
      temporal: mappedTemporal,
      sleep: {
        ...(sleep.durationMinutes
          ? {
              durationMinutes: sleep.durationMinutes.value,
              durationIsApproximate: sleep.durationMinutes.precision === 'approximate'
            }
          : {}),
        ...(sleep.bedtime
          ? {
              fellAsleepAt: sleep.bedtime.value,
              fellAsleepAtIsApproximate: sleep.bedtime.precision === 'approximate'
            }
          : {}),
        ...(sleep.wakeTime
          ? {
              wokeAt: sleep.wakeTime.value,
              wokeAtIsApproximate: sleep.wakeTime.precision === 'approximate'
            }
          : {}),
        ...(sleep.awakeningCount ? { awakenings: sleep.awakeningCount.value } : {}),
        ...(sleep.awakeningCount
          ? { awakeningsIsApproximate: sleep.awakeningCount.precision === 'approximate' }
          : {}),
        ...(sleep.quality
          ? {
              quality: sleep.quality.value as never,
              qualityIsApproximate: sleep.quality.precision === 'approximate'
            }
          : {}),
        ...(sleep.wakeFeeling
          ? {
              restedness: sleep.wakeFeeling.value as never,
              restednessIsApproximate: sleep.wakeFeeling.precision === 'approximate'
            }
          : {})
      }
    };
  }

  const mood = observation.data as MoodEventData | MoodDailySummaryData;
  const moodData = {
    ...(mood.descriptors ? { emotions: [...mood.descriptors] } : {}),
    ...(mood.isMixed === true ? { isMixed: true } : {}),
    ...(mood.explicitRating
      ? {
          score: mood.explicitRating.value,
          scoreScaleMax: mood.explicitRating.scaleMax
        }
      : {}),
    ...(mood.explicitIntensity
      ? {
          intensity: mood.explicitIntensity.value,
          intensityScaleMax: mood.explicitIntensity.scaleMax
        }
      : {}),
    ...(observation.kind === 'mood_daily_summary'
      ? {
          coverage:
            (mood as MoodDailySummaryData).coverage === 'sufficient'
              ? ('full_day' as const)
              : (mood as MoodDailySummaryData).coverage === 'partial'
                ? ('partial_day' as const)
                : ('unknown' as const)
        }
      : {})
  };

  return observation.kind === 'mood_daily_summary'
    ? {
        observationId: observation.id.value,
        sourceMessageId: source.sourceMessageId,
        kind: 'mood_daily_summary',
        temporal: mappedTemporal,
        mood: moodData
      }
    : {
        observationId: observation.id.value,
        sourceMessageId: source.sourceMessageId,
        kind: 'mood_event',
        temporal: mappedTemporal,
        mood: moodData
      };
}

function mayContainCorrection(message: string): boolean {
  return /\b(na verdade|corrig(?:indo|ir|e)|quis dizer|não era|actually|i meant|correction|en realidad|quise decir|corrijo)\b/iu.test(
    message
  );
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

function candidateFingerprint(candidate: {
  kind: string;
  data: unknown;
  temporalReference: unknown;
  correctsObservationId?: string;
  removeFields?: readonly string[];
}): string {
  const comparableCandidate = {
    kind: candidate.kind,
    data: candidate.data,
    temporalReference: candidate.temporalReference,
    ...(candidate.correctsObservationId
      ? { correctsObservationId: candidate.correctsObservationId }
      : {}),
    ...(candidate.removeFields?.length ? { removeFields: [...candidate.removeFields] } : {})
  };

  return createHash('sha256')
    .update(JSON.stringify(canonicalize(comparableCandidate)))
    .digest('hex')
    .slice(0, 32);
}

export class CaptureWellbeingObservationsUseCase {
  constructor(
    private readonly extractor: ObservationExtractor,
    private readonly validationPolicy: WellbeingCandidateValidationPolicy,
    private readonly repository: WellbeingObservationRepository,
    private readonly userRepository: UserRepository,
    private readonly usageService: UsageService,
    private readonly eventDispatcher: EventDispatcher,
    private readonly moodProjector: DailyMoodSummaryProjectorService,
    private readonly fingerprintService: SensitiveTextFingerprintPort,
    private readonly persistEnabled = false
  ) {}

  async execute(
    input: CaptureWellbeingObservationsInput
  ): Promise<CaptureWellbeingObservationsOutput> {
    if (!input.allowAutomaticCapture) {
      return this.skipped('skipped_by_policy');
    }

    if (!(await this.userCanReceiveAutomaticCapture(input.userId))) {
      return this.skipped('skipped_user_unavailable');
    }

    const referenceAt = input.referenceAt ?? new Date();
    const recent = mayContainCorrection(input.currentUserMessage)
      ? (await this.repository.list(input.userId))
          .map((observation) => toRecentStructuredObservation(observation))
          .filter((observation): observation is RecentStructuredObservation => Boolean(observation))
          .slice(0, 10)
      : [];
    const request: ObservationExtractionRequest = {
      currentUserMessage: input.currentUserMessage,
      referenceAt: referenceAt.toISOString(),
      timezone: normalizeTimezone(input.timezone),
      sourceMessageId: input.sourceMessageId,
      conversationId: input.conversationId,
      recentStructuredObservations: recent
    };
    const extraction = await this.extractor.extract(request);

    if (
      extraction.trust !== 'untrusted_model_output' ||
      extraction.source.sourceMessageId !== input.sourceMessageId ||
      extraction.source.conversationId !== input.conversationId ||
      extraction.schemaVersion !== extraction.metadata.schemaVersion
    ) {
      throw new Error('Observation extractor returned inconsistent execution metadata');
    }

    // Account deactivation can happen while the provider call is in flight. Recheck before writes.
    if (!(await this.userCanReceiveAutomaticCapture(input.userId))) {
      return {
        ...this.skipped('skipped_user_unavailable'),
        extracted: extraction.candidates.length
      };
    }

    let accepted = 0;
    let created = 0;
    let corrected = 0;
    let wouldCreate = 0;
    let wouldCorrect = 0;
    let rejected = 0;
    let deduplicated = 0;
    const seenCandidateFingerprints = new Set<string>();

    for (const rawCandidate of extraction.candidates) {
      const result = this.validationPolicy.validate(
        toDomainCandidate(rawCandidate, request.timezone),
        {
          sourceMessage: input.currentUserMessage,
          sourceMessageId: input.sourceMessageId,
          conversationId: input.conversationId,
          modelRef: `${extraction.metadata.provider}:${extraction.metadata.model ?? 'none'}`,
          promptRef: extraction.metadata.promptVersion,
          schemaRef: extraction.metadata.schemaVersion
        }
      );

      if (!result.accepted) {
        rejected += 1;
        continue;
      }

      const candidate = result.candidate;
      const { evidenceQuote, ...provenanceWithoutEvidence } = candidate.provenance;
      const persistedProvenance = {
        ...provenanceWithoutEvidence,
        evidenceFingerprint: this.fingerprintService.fingerprint({
          purpose: 'wellbeing_evidence',
          userId: input.userId,
          conversationId: input.conversationId,
          sourceMessageId: input.sourceMessageId,
          text: evidenceQuote
        })
      } as ConversationExtractionProvenance | ConversationCorrectionProvenance;
      const fingerprint = candidateFingerprint(candidate);
      if (seenCandidateFingerprints.has(fingerprint)) {
        deduplicated += 1;
        continue;
      }

      seenCandidateFingerprints.add(fingerprint);
      accepted += 1;

      if (candidate.correctsObservationId) {
        const target = await this.repository.findById(
          input.userId,
          candidate.correctsObservationId
        );
        const correctionWasAlreadyApplied = target?.provenanceHistory.some(
          (entry) =>
            entry.source === 'conversation_extraction' &&
            entry.sourceMessageId === input.sourceMessageId &&
            'correctsObservationId' in entry &&
            entry.correctsObservationId === candidate.correctsObservationId
        );

        if (!target || target.kind !== candidate.kind || target.isManuallyControlled) {
          rejected += 1;
          continue;
        }
        if (correctionWasAlreadyApplied) {
          if (!this.persistEnabled) {
            deduplicated += 1;
            continue;
          }
          const staleEvents = await this.invalidateDependentMoodSummaries(
            target,
            'source_observation_corrected'
          );
          await this.eventDispatcher.dispatch(staleEvents);
          await this.moodProjector.refreshAfter(target);
          continue;
        }

        const previousTemporalReference = target.temporalReference;
        const correctionPatch = Object.fromEntries([
          ...Object.entries(candidate.data),
          ...(candidate.removeFields ?? []).map((field) => [field, null] as const)
        ]);
        const mergedCorrectionData = applyWellbeingObservationMergePatch(
          target.data,
          correctionPatch
        );
        const nextTemporalReference =
          candidate.temporalReference.kind === 'unknown'
            ? target.temporalReference
            : candidate.temporalReference;

        if (!this.persistEnabled) {
          if (
            validateWellbeingObservationData(target.kind, mergedCorrectionData).length > 0 ||
            validateTemporalReference(nextTemporalReference).length > 0
          ) {
            rejected += 1;
            continue;
          }
          wouldCorrect += 1;
          continue;
        }

        try {
          target.correctFromConversation(
            {
              kind: target.kind,
              data: mergedCorrectionData as never,
              temporalReference: nextTemporalReference
            },
            persistedProvenance as ConversationCorrectionProvenance,
            referenceAt
          );
        } catch {
          rejected += 1;
          continue;
        }
        await this.repository.update(input.userId, target);
        const events = target.pullDomainEvents();
        const staleEvents = await this.invalidateDependentMoodSummaries(
          target,
          'source_observation_corrected'
        );
        await this.eventDispatcher.dispatch([...events, ...staleEvents]);
        await this.moodProjector.refreshAfter(target, previousTemporalReference);
        corrected += 1;
        continue;
      }

      if (!this.persistEnabled) {
        wouldCreate += 1;
        continue;
      }

      const idempotencyKey = `conversation:${input.conversationId}:${input.sourceMessageId}:${candidate.kind}:${persistedProvenance.evidenceFingerprint.slice(0, 32)}:v4`;
      const observation = WellbeingObservation.create({
        userId: input.userId,
        idempotencyKey,
        kind: candidate.kind,
        data: candidate.data,
        temporalReference: candidate.temporalReference,
        provenance: persistedProvenance,
        createdAt: referenceAt,
        updatedAt: referenceAt
      });
      const events = observation.pullDomainEvents();
      const saved = await this.repository.saveIfAbsent(input.userId, idempotencyKey, observation);
      if (saved.created) {
        created += 1;
        await this.eventDispatcher.dispatch(events);
        await this.moodProjector.refreshAfter(saved.observation);
      } else {
        deduplicated += 1;
      }
    }

    await this.usageService.registerAuxiliaryLlmUsage(input.userId, extraction.usage);

    return {
      status: this.persistEnabled ? 'captured' : 'shadow_evaluated',
      extracted: extraction.candidates.length,
      accepted,
      created,
      corrected,
      wouldCreate,
      wouldCorrect,
      rejected,
      deduplicated
    };
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

  private async userCanReceiveAutomaticCapture(userId: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    return Boolean(
      user &&
      !user.hasScheduledDeletion() &&
      user.profile?.privacySettings.allowMoodInsights === true &&
      user.profile.privacySettings.allowSensitiveDataStorage === true
    );
  }

  private skipped(
    status: Extract<CaptureWellbeingObservationsOutput['status'], `skipped_${string}`>
  ): CaptureWellbeingObservationsOutput {
    return {
      status,
      extracted: 0,
      accepted: 0,
      created: 0,
      corrected: 0,
      wouldCreate: 0,
      wouldCorrect: 0,
      rejected: 0,
      deduplicated: 0
    };
  }
}
