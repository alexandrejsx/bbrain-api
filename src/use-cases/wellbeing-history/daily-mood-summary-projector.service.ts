import { EventDispatcher } from '../../domain/core/event-dispatcher';
import { WellbeingObservation } from '../../domain/wellbeing-history/entities/wellbeing-observation.entity';
import { WellbeingObservationRepository } from '../../domain/wellbeing-history/repositories/wellbeing-observation.repository';
import {
  CreateWellbeingObservationProps,
  TemporalReference
} from '../../domain/wellbeing-history/value-objects/wellbeing-observation.types';

export const DAILY_MOOD_PROJECTOR_VERSION = 'daily-mood-projector.v2' as const;
const MAX_DERIVED_MOOD_DESCRIPTORS = 12;
export const MAX_DERIVED_MOOD_SOURCE_EVENTS = 200;

export function moodProjectionDateForTemporal(temporal: TemporalReference): string | undefined {
  if (temporal.kind === 'specific_day' || temporal.kind === 'specific_night') {
    return temporal.localDate;
  }

  const formatInstant = (instant: Date) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: temporal.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(instant);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return values.year && values.month && values.day
      ? `${values.year}-${values.month}-${values.day}`
      : undefined;
  };

  if (temporal.kind === 'interval') {
    const startDate = formatInstant(temporal.startsAt);
    const endDate = formatInstant(temporal.endsAt);
    return startDate && startDate === endDate ? startDate : undefined;
  }
  if (temporal.kind !== 'moment') return undefined;

  return formatInstant(temporal.at);
}

function localDateFor(observation: WellbeingObservation): string | undefined {
  return moodProjectionDateForTemporal(observation.temporalReference);
}

export class DailyMoodSummaryProjectorService {
  constructor(
    private readonly repository: WellbeingObservationRepository,
    private readonly eventDispatcher: EventDispatcher
  ) {}

  async refreshAfter(
    observation: WellbeingObservation,
    previousTemporalReference?: TemporalReference
  ): Promise<void> {
    if (observation.kind !== 'mood_event' && observation.kind !== 'mood_daily_summary') return;
    const dates = new Map<string, string>();
    const currentDate = localDateFor(observation);
    const previousDate = previousTemporalReference
      ? moodProjectionDateForTemporal(previousTemporalReference)
      : undefined;

    if (previousDate && previousTemporalReference) {
      dates.set(previousDate, previousTemporalReference.timezone);
    }
    if (currentDate) dates.set(currentDate, observation.temporalReference.timezone);

    for (const [localDate, timezone] of dates) {
      await this.refreshDate(observation.userId, localDate, timezone);
    }
  }

  private async refreshDate(userId: string, localDate: string, timezone: string): Promise<void> {
    const all = await this.repository.list(userId, {
      kinds: ['mood_event', 'mood_daily_summary']
    });
    const summaries = all.filter(
      (item): item is WellbeingObservation<'mood_daily_summary'> =>
        item.kind === 'mood_daily_summary' && localDateFor(item) === localDate
    );
    const allDerived = summaries.filter((summary) => summary.data.summarySource === 'derived');
    const currentDerived = allDerived.filter((summary) => summary.data.status === 'current');
    const preferredSummaryExists = summaries.some(
      (summary) =>
        summary.data.status === 'current' &&
        (summary.data.summarySource === 'manual_override' ||
          summary.data.summarySource === 'user_explicit')
    );

    if (preferredSummaryExists) {
      await this.markDerivedStale(currentDerived, userId, 'preferred_summary_available');
      return;
    }

    const events = all.filter(
      (item): item is WellbeingObservation<'mood_event'> =>
        item.kind === 'mood_event' && localDateFor(item) === localDate
    );
    const sourceEvents = events.slice(0, MAX_DERIVED_MOOD_SOURCE_EVENTS);
    const descriptors = [
      ...new Set(
        sourceEvents.flatMap((event) => event.data.descriptors ?? []).map((value) => value.trim())
      )
    ]
      .filter(Boolean)
      .sort((first, second) => first.localeCompare(second, 'pt-BR'))
      .slice(0, MAX_DERIVED_MOOD_DESCRIPTORS);
    const hasExplicitMixedReport = sourceEvents.some((event) => event.data.isMixed === true);

    // Two distinct primary events are the conservative MVP threshold. Coverage remains partial.
    if (events.length < 2 || (descriptors.length === 0 && !hasExplicitMixedReport)) {
      await this.markDerivedStale(currentDerived, userId, 'insufficient_primary_events');
      return;
    }

    const sourceObservationIds = sourceEvents.map((event) => event.id.value).sort();
    const sourceObservationVersions = sourceEvents
      .map((event) => ({ observationId: event.id.value, revision: event.revision }))
      .sort((left, right) => left.observationId.localeCompare(right.observationId));
    const idempotencyKey = `derived-mood:${localDate}:${DAILY_MOOD_PROJECTOR_VERSION}`;
    const matching = allDerived.find((summary) => summary.idempotencyKey === idempotencyKey);

    await this.markDerivedStale(
      currentDerived.filter((summary) => summary.id.value !== matching?.id.value),
      userId,
      'source_set_changed'
    );

    if (matching) {
      const changed = matching.refreshDerivedProjection(
        {
          ...(descriptors.length ? { descriptors } : {}),
          ...(hasExplicitMixedReport ? { isMixed: true } : {}),
          sourceObservationIds,
          sourceObservationVersions,
          coverage: 'partial',
          status: 'current',
          summarySource: 'derived'
        },
        {
          kind: 'specific_day',
          localDate,
          timezone,
          precision: 'exact'
        },
        {
          source: 'derived_projection',
          projectionRef: DAILY_MOOD_PROJECTOR_VERSION,
          sourceObservationIds
        }
      );
      if (changed) {
        await this.repository.update(userId, matching);
        await this.eventDispatcher.dispatch(matching.pullDomainEvents());
      }
      return;
    }

    const now = new Date();
    const summary = WellbeingObservation.create({
      userId,
      idempotencyKey,
      kind: 'mood_daily_summary',
      data: {
        ...(descriptors.length ? { descriptors } : {}),
        ...(hasExplicitMixedReport ? { isMixed: true } : {}),
        sourceObservationIds,
        sourceObservationVersions,
        coverage: 'partial',
        status: 'current',
        summarySource: 'derived'
      },
      temporalReference: {
        kind: 'specific_day',
        localDate,
        timezone,
        precision: 'exact'
      },
      provenance: {
        source: 'derived_projection',
        projectionRef: DAILY_MOOD_PROJECTOR_VERSION,
        sourceObservationIds
      },
      createdAt: now,
      updatedAt: now
    } satisfies CreateWellbeingObservationProps<'mood_daily_summary'>);
    const domainEvents = summary.pullDomainEvents();
    const saved = await this.repository.saveIfAbsent(userId, idempotencyKey, summary);
    if (saved.created) await this.eventDispatcher.dispatch(domainEvents);
  }

  private async markDerivedStale(
    summaries: WellbeingObservation<'mood_daily_summary'>[],
    userId: string,
    reason: string
  ): Promise<void> {
    for (const summary of summaries) {
      if (!summary.markStale(reason)) continue;
      await this.repository.update(userId, summary);
      await this.eventDispatcher.dispatch(summary.pullDomainEvents());
    }
  }
}
