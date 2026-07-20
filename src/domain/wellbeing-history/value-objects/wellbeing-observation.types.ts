export const WELLBEING_OBSERVATION_KINDS = [
  'mood_event',
  'mood_daily_summary',
  'sleep_record'
] as const;

export type WellbeingObservationKind = (typeof WELLBEING_OBSERVATION_KINDS)[number];

export type ValuePrecision = 'exact' | 'approximate';

export interface PrecisionPreservedValue<T> {
  value: T;
  precision: ValuePrecision;
}

export interface ExplicitMoodRating {
  value: number;
  /** Present only when the user explicitly supplied the lower bound. */
  scaleMin?: number;
  scaleMax: number;
}

export interface MoodEventData {
  descriptors?: readonly string[];
  isMixed?: boolean;
  intensityDescriptor?: string;
  explicitIntensity?: ExplicitMoodRating;
  explicitRating?: ExplicitMoodRating;
}

export type MoodSummaryCoverage = 'partial' | 'sufficient' | 'unknown';
export type MoodSummaryStatus = 'current' | 'stale';
export type MoodSummarySource = 'derived' | 'user_explicit' | 'manual_override';

export interface MoodDailySummaryData extends MoodEventData {
  sourceObservationIds: readonly string[];
  sourceObservationVersions?: readonly { observationId: string; revision: number }[];
  coverage: MoodSummaryCoverage;
  status: MoodSummaryStatus;
  summarySource: MoodSummarySource;
  staleReason?: string;
}

export interface SleepRecordData {
  durationMinutes?: PrecisionPreservedValue<number>;
  quality?: PrecisionPreservedValue<string>;
  bedtime?: PrecisionPreservedValue<string>;
  wakeTime?: PrecisionPreservedValue<string>;
  awakeningCount?: PrecisionPreservedValue<number>;
  wakeFeeling?: PrecisionPreservedValue<string>;
}

interface KnownTemporalReference {
  timezone: string;
  precision: ValuePrecision;
}

export interface MomentTemporalReference extends KnownTemporalReference {
  kind: 'moment';
  at: Date;
}

export interface SpecificDayTemporalReference extends KnownTemporalReference {
  kind: 'specific_day';
  localDate: string;
}

export interface SpecificNightTemporalReference extends KnownTemporalReference {
  kind: 'specific_night';
  /** Local date on which the night started. */
  localDate: string;
}

export interface IntervalTemporalReference extends KnownTemporalReference {
  kind: 'interval';
  startsAt: Date;
  endsAt: Date;
}

export interface PeriodTemporalReference extends KnownTemporalReference {
  kind: 'period';
  startsOn?: string;
  endsOn?: string;
  descriptor?: string;
}

export interface UnknownTemporalReference {
  kind: 'unknown';
  timezone: string;
}

export type TemporalReference =
  | MomentTemporalReference
  | SpecificDayTemporalReference
  | SpecificNightTemporalReference
  | IntervalTemporalReference
  | PeriodTemporalReference
  | UnknownTemporalReference;

export interface ConversationExtractionProvenance {
  source: 'conversation_extraction';
  sourceMessageId: string;
  conversationId: string;
  evidenceFingerprint: string;
  confidence: number;
  modelRef: string;
  promptRef: string;
  schemaRef: string;
}

export interface ConversationCorrectionProvenance extends ConversationExtractionProvenance {
  correctsObservationId: string;
}

export interface ManualProvenance {
  source: 'manual';
}

export interface DerivedProjectionProvenance {
  source: 'derived_projection';
  projectionRef: string;
  sourceObservationIds: readonly string[];
}

export interface ManualCorrectionProvenance {
  source: 'manual_correction';
  correctedAt: Date;
}

export type InitialWellbeingObservationProvenance =
  | ConversationExtractionProvenance
  | ManualProvenance
  | DerivedProjectionProvenance;

export type WellbeingObservationProvenance =
  | InitialWellbeingObservationProvenance
  | ConversationCorrectionProvenance
  | ManualCorrectionProvenance;

export type WellbeingObservationProvenanceHistory = readonly [
  InitialWellbeingObservationProvenance,
  ...(ConversationCorrectionProvenance | ManualCorrectionProvenance)[]
];

export interface WellbeingObservationDataByKind {
  mood_event: MoodEventData;
  mood_daily_summary: MoodDailySummaryData;
  sleep_record: SleepRecordData;
}

export type WellbeingObservationRevisionOperation =
  | 'manual_correction'
  | 'conversation_correction'
  | 'projection_marked_stale'
  | 'projection_restored'
  | 'projection_refreshed';

export interface WellbeingObservationRevision {
  revision: number;
  data: WellbeingObservationDataByKind[WellbeingObservationKind];
  temporalReference: TemporalReference;
  provenance: WellbeingObservationProvenance;
  operation: WellbeingObservationRevisionOperation;
  updatedAt: Date;
  supersededAt: Date;
}

export interface WellbeingManualCorrectionDataByKind {
  mood_event: MoodEventData;
  mood_daily_summary: Omit<MoodDailySummaryData, 'status' | 'summarySource' | 'staleReason'>;
  sleep_record: SleepRecordData;
}

interface WellbeingObservationCommonProps {
  userId: string;
  idempotencyKey: string;
  temporalReference: TemporalReference;
  provenanceHistory: WellbeingObservationProvenanceHistory;
  revisionHistory: readonly WellbeingObservationRevision[];
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

export type WellbeingObservationProps<
  K extends WellbeingObservationKind = WellbeingObservationKind
> = WellbeingObservationCommonProps & {
  kind: K;
  data: WellbeingObservationDataByKind[K];
};

export type CreateWellbeingObservationProps<K extends WellbeingObservationKind> = Omit<
  WellbeingObservationProps<K>,
  'provenanceHistory' | 'revisionHistory' | 'revision' | 'createdAt' | 'updatedAt'
> & {
  provenance: InitialWellbeingObservationProvenance;
  createdAt?: Date;
  updatedAt?: Date;
};

export type ManualWellbeingObservationCorrection<
  K extends WellbeingObservationKind = WellbeingObservationKind
> = {
  kind: K;
  data: WellbeingManualCorrectionDataByKind[K];
  temporalReference?: TemporalReference;
};

export type ConversationWellbeingObservationCorrection<
  K extends WellbeingObservationKind = WellbeingObservationKind
> = {
  kind: K;
  data: WellbeingObservationDataByKind[K];
  temporalReference?: TemporalReference;
};
