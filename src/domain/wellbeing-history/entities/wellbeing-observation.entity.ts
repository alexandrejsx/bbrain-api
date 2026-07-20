import { AggregateRoot } from '../../core/aggregate-root';
import { Uuid } from '../../shared/uuid.vo';
import {
  WellbeingMoodSummaryMarkedStaleEvent,
  WellbeingMoodSummaryRestoredEvent,
  WellbeingObservationCorrectedEvent,
  WellbeingObservationCreatedEvent,
  WellbeingObservationRemovedEvent
} from '../events/wellbeing-observation.events';
import {
  ConversationCorrectionProvenance,
  ConversationWellbeingObservationCorrection,
  CreateWellbeingObservationProps,
  DerivedProjectionProvenance,
  ManualWellbeingObservationCorrection,
  MoodDailySummaryData,
  TemporalReference,
  WellbeingObservationDataByKind,
  WellbeingObservationKind,
  WellbeingObservationProps,
  WellbeingObservationProvenance,
  WellbeingObservationProvenanceHistory,
  WellbeingObservationRevision,
  WellbeingObservationRevisionOperation
} from '../value-objects/wellbeing-observation.types';
import {
  assertValidWellbeingObservationInput,
  isNonEmptyText,
  isValidDate,
  MAX_EMBEDDED_WELLBEING_REVISIONS,
  validateTemporalReference,
  validateWellbeingObservationData
} from '../value-objects/wellbeing-observation.validators';

function clone<T>(value: T): T {
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (Array.isArray(value)) return value.map((item) => clone(item)) as T;
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, clone(nestedValue)])
    ) as T;
  }

  return value;
}

function serialize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, serialize(nestedValue)])
    );
  }

  return value;
}

function assertChronologicalUpdate(updatedAt: Date, previousUpdatedAt: Date): void {
  if (!isValidDate(updatedAt)) throw new Error('updatedAt must be a valid date');
  if (updatedAt < previousUpdatedAt) throw new Error('updatedAt cannot move backwards');
}

export class WellbeingObservation<
  K extends WellbeingObservationKind = WellbeingObservationKind
> extends AggregateRoot<WellbeingObservationProps<K>> {
  private constructor(
    private readonly props: WellbeingObservationProps<K>,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create<K extends WellbeingObservationKind>(
    input: CreateWellbeingObservationProps<K>,
    id?: Uuid
  ): WellbeingObservation<K> {
    const createdAt = clone(input.createdAt ?? new Date());
    const updatedAt = clone(input.updatedAt ?? createdAt);
    const props = {
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
      kind: input.kind,
      data: clone(input.data),
      temporalReference: clone(input.temporalReference),
      provenanceHistory: [clone(input.provenance)],
      revisionHistory: [],
      revision: 1,
      createdAt,
      updatedAt
    } as WellbeingObservationProps<K>;

    assertValidWellbeingObservationInput(props);

    const observation = new WellbeingObservation(props, id);
    observation.addDomainEvent(
      new WellbeingObservationCreatedEvent(observation.id.value, createdAt)
    );
    return observation;
  }

  static reconstitute<K extends WellbeingObservationKind>(
    props: WellbeingObservationProps<K>,
    id: Uuid
  ): WellbeingObservation<K> {
    const safeProps = clone(props);
    assertValidWellbeingObservationInput(safeProps);
    return new WellbeingObservation(safeProps, id);
  }

  correctManually(
    correction: ManualWellbeingObservationCorrection<K>,
    correctedAt = new Date()
  ): void {
    if (correction.kind !== this.props.kind) {
      throw new Error('A correction cannot change the observation kind');
    }
    assertChronologicalUpdate(correctedAt, this.props.updatedAt);

    const nextData =
      correction.kind === 'mood_daily_summary'
        ? {
            ...correction.data,
            status: 'current' as const,
            summarySource: 'manual_override' as const
          }
        : correction.data;
    const nextTemporalReference = correction.temporalReference ?? this.props.temporalReference;
    const dataErrors = validateWellbeingObservationData(this.props.kind, nextData);
    const temporalErrors = validateTemporalReference(nextTemporalReference);

    if (dataErrors.length > 0 || temporalErrors.length > 0) {
      throw new Error(
        `Invalid wellbeing correction: ${[...dataErrors, ...temporalErrors].join('; ')}`
      );
    }

    this.archiveCurrentRevision('manual_correction', correctedAt);
    this.props.data = clone(nextData) as WellbeingObservationDataByKind[K];
    this.props.temporalReference = clone(nextTemporalReference);
    this.props.provenanceHistory = [
      ...this.props.provenanceHistory,
      { source: 'manual_correction', correctedAt: clone(correctedAt) }
    ] as WellbeingObservationProvenanceHistory;
    this.props.revision += 1;
    this.props.updatedAt = clone(correctedAt);
    this.addDomainEvent(new WellbeingObservationCorrectedEvent(this.id.value, correctedAt));
  }

  correctFromConversation(
    correction: ConversationWellbeingObservationCorrection<K>,
    provenance: ConversationCorrectionProvenance,
    correctedAt = new Date()
  ): void {
    if (this.isManuallyControlled) {
      throw new Error('Conversation extraction cannot overwrite a manual observation');
    }
    if (provenance.correctsObservationId !== this.id.value) {
      throw new Error('Conversation correction target does not match the observation');
    }
    if (correction.kind !== this.props.kind) {
      throw new Error('A correction cannot change the observation kind');
    }
    assertChronologicalUpdate(correctedAt, this.props.updatedAt);

    if (
      correction.kind === 'mood_daily_summary' &&
      (correction.data as MoodDailySummaryData).summarySource === 'manual_override'
    ) {
      throw new Error('Conversation extraction cannot create a manual summary override');
    }

    const currentSummary =
      this.props.kind === 'mood_daily_summary'
        ? (this.props.data as unknown as MoodDailySummaryData)
        : undefined;
    const nextSummary =
      correction.kind === 'mood_daily_summary'
        ? (correction.data as MoodDailySummaryData)
        : undefined;

    if (
      currentSummary?.summarySource === 'user_explicit' &&
      nextSummary?.summarySource === 'derived'
    ) {
      throw new Error('A derived summary cannot overwrite an explicit user summary');
    }

    const nextTemporalReference = correction.temporalReference ?? this.props.temporalReference;
    const dataErrors = validateWellbeingObservationData(this.props.kind, correction.data);
    const temporalErrors = validateTemporalReference(nextTemporalReference);

    if (dataErrors.length > 0 || temporalErrors.length > 0) {
      throw new Error(
        `Invalid wellbeing correction: ${[...dataErrors, ...temporalErrors].join('; ')}`
      );
    }

    this.archiveCurrentRevision('conversation_correction', correctedAt);
    this.props.data = clone(correction.data);
    this.props.temporalReference = clone(nextTemporalReference);
    this.props.provenanceHistory = [
      ...this.props.provenanceHistory,
      clone(provenance)
    ] as WellbeingObservationProvenanceHistory;
    this.props.revision += 1;
    this.props.updatedAt = clone(correctedAt);
    this.addDomainEvent(new WellbeingObservationCorrectedEvent(this.id.value, correctedAt));
  }

  markStale(reason: string, updatedAt = new Date()): boolean {
    if (this.props.kind !== 'mood_daily_summary') {
      throw new Error('Only mood daily summaries can be marked stale');
    }
    if (!isNonEmptyText(reason)) throw new Error('A stale reason is required');
    assertChronologicalUpdate(updatedAt, this.props.updatedAt);

    const summary = this.props.data as unknown as MoodDailySummaryData;
    if (summary.summarySource === 'manual_override' || summary.status === 'stale') return false;

    this.archiveCurrentRevision('projection_marked_stale', updatedAt);
    this.props.data = {
      ...summary,
      status: 'stale',
      staleReason: reason
    };
    this.props.revision += 1;
    this.props.updatedAt = clone(updatedAt);
    this.addDomainEvent(new WellbeingMoodSummaryMarkedStaleEvent(this.id.value, updatedAt));
    return true;
  }

  restoreDerivedSummary(updatedAt = new Date()): boolean {
    if (this.props.kind !== 'mood_daily_summary') {
      throw new Error('Only mood daily summaries can be restored');
    }
    assertChronologicalUpdate(updatedAt, this.props.updatedAt);

    const summary = this.props.data as unknown as MoodDailySummaryData;
    if (summary.summarySource !== 'derived') {
      throw new Error('Only derived mood summaries can be restored');
    }
    if (summary.status === 'current') return false;

    const restoredSummary: MoodDailySummaryData = { ...summary, status: 'current' };
    delete restoredSummary.staleReason;
    this.archiveCurrentRevision('projection_restored', updatedAt);
    this.props.data = restoredSummary;
    this.props.revision += 1;
    this.props.updatedAt = clone(updatedAt);
    this.addDomainEvent(new WellbeingMoodSummaryRestoredEvent(this.id.value, updatedAt));
    return true;
  }

  refreshDerivedProjection(
    data: MoodDailySummaryData,
    temporalReference: TemporalReference,
    provenance: DerivedProjectionProvenance,
    updatedAt = new Date()
  ): boolean {
    if (this.props.kind !== 'mood_daily_summary') {
      throw new Error('Only mood daily summaries can refresh a derived projection');
    }
    const current = this.props.data as unknown as MoodDailySummaryData;
    if (current.summarySource !== 'derived' || data.summarySource !== 'derived') {
      throw new Error('Only derived mood summaries can refresh a derived projection');
    }
    assertChronologicalUpdate(updatedAt, this.props.updatedAt);

    const nextData = { ...data, status: 'current' as const };
    delete nextData.staleReason;
    const dataErrors = validateWellbeingObservationData('mood_daily_summary', nextData);
    const temporalErrors = validateTemporalReference(temporalReference);
    if (dataErrors.length > 0 || temporalErrors.length > 0) {
      throw new Error(
        `Invalid derived projection: ${[...dataErrors, ...temporalErrors].join('; ')}`
      );
    }

    if (
      JSON.stringify(serialize(current)) === JSON.stringify(serialize(nextData)) &&
      JSON.stringify(serialize(this.props.temporalReference)) ===
        JSON.stringify(serialize(temporalReference))
    ) {
      return false;
    }

    this.archiveCurrentRevision('projection_refreshed', updatedAt);
    this.props.data = clone(nextData);
    this.props.temporalReference = clone(temporalReference);
    this.props.provenanceHistory = [clone(provenance)] as WellbeingObservationProvenanceHistory;
    this.props.revision += 1;
    this.props.updatedAt = clone(updatedAt);
    this.addDomainEvent(new WellbeingObservationCorrectedEvent(this.id.value, updatedAt));
    return true;
  }

  markRemoved(removedAt = new Date()): void {
    if (!isValidDate(removedAt)) throw new Error('removedAt must be a valid date');
    this.addDomainEvent(new WellbeingObservationRemovedEvent(this.id.value, removedAt));
  }

  get userId(): string {
    return this.props.userId;
  }

  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }

  get kind(): K {
    return this.props.kind;
  }

  get data(): WellbeingObservationDataByKind[K] {
    return clone(this.props.data);
  }

  get temporalReference(): TemporalReference {
    return clone(this.props.temporalReference);
  }

  get provenanceHistory(): WellbeingObservationProvenanceHistory {
    return clone(this.props.provenanceHistory);
  }

  get revisionHistory(): readonly WellbeingObservationRevision[] {
    return clone(this.props.revisionHistory);
  }

  get currentProvenance(): WellbeingObservationProvenance {
    return clone(this.props.provenanceHistory[this.props.provenanceHistory.length - 1]);
  }

  get revision(): number {
    return this.props.revision;
  }

  get createdAt(): Date {
    return clone(this.props.createdAt);
  }

  get updatedAt(): Date {
    return clone(this.props.updatedAt);
  }

  get isManuallyControlled(): boolean {
    return this.props.provenanceHistory.some(
      (entry) => entry.source === 'manual' || entry.source === 'manual_correction'
    );
  }

  toJson() {
    return {
      id: this.id.value,
      userId: this.userId,
      idempotencyKey: this.idempotencyKey,
      kind: this.kind,
      data: serialize(this.props.data),
      temporalReference: serialize(this.props.temporalReference),
      provenance: serialize(this.currentProvenance),
      provenanceHistory: serialize(this.props.provenanceHistory),
      revisionHistory: serialize(this.props.revisionHistory),
      revision: this.revision,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  private archiveCurrentRevision(
    operation: WellbeingObservationRevisionOperation,
    supersededAt: Date
  ): void {
    if (this.props.revisionHistory.length >= MAX_EMBEDDED_WELLBEING_REVISIONS) {
      throw new Error(
        'Wellbeing observation reached the embedded revision limit; migrate revisions before correcting again'
      );
    }
    this.props.revisionHistory = [
      ...this.props.revisionHistory,
      {
        revision: this.props.revision,
        data: clone(this.props.data),
        temporalReference: clone(this.props.temporalReference),
        provenance: clone(this.props.provenanceHistory[this.props.provenanceHistory.length - 1]),
        operation,
        updatedAt: clone(this.props.updatedAt),
        supersededAt: clone(supersededAt)
      }
    ];
  }
}
