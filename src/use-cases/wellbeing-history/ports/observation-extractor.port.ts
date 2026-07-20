import { LlmUsage } from '../../../domain/usage/value-objects/llm-usage';

export const OBSERVATION_EXTRACTION_SCHEMA_VERSION = 'wellbeing-observation-extraction.v3' as const;

export const OBSERVATION_CANDIDATE_KINDS = [
  'mood_event',
  'mood_daily_summary',
  'sleep_record'
] as const;
export const OBSERVATION_SUBJECTS = ['user', 'third_party', 'unknown'] as const;
export const OBSERVATION_ASSERTIONS = [
  'affirmed',
  'negated',
  'hypothetical',
  'future_intent',
  'conditional',
  'fictional',
  'uncertain'
] as const;
export const OBSERVATION_REPORTING_MODES = [
  'specific_occurrence',
  'daily_summary',
  'period_summary',
  'correction'
] as const;
export const OBSERVATION_EVIDENCE_MODES = ['direct_self_report', 'third_party_report'] as const;
export const OBSERVATION_TEMPORAL_SCOPES = [
  'moment',
  'day',
  'night',
  'interval',
  'ongoing_period',
  'unknown'
] as const;
export const OBSERVATION_TEMPORAL_PRECISIONS = [
  'exact',
  'approximate',
  'relative',
  'unknown'
] as const;
export const MOOD_COVERAGES = ['single_moment', 'partial_day', 'full_day', 'unknown'] as const;
export const SLEEP_QUALITIES = ['very_poor', 'poor', 'fair', 'good', 'very_good'] as const;
export const SLEEP_RESTEDNESS_VALUES = [
  'exhausted',
  'tired',
  'neutral',
  'rested',
  'very_rested'
] as const;
export const MOOD_CORRECTION_REMOVABLE_FIELDS = [
  'emotions',
  'isMixed',
  'intensity',
  'score'
] as const;
export const SLEEP_CORRECTION_REMOVABLE_FIELDS = [
  'durationMinutes',
  'fellAsleepAt',
  'wokeAt',
  'awakenings',
  'quality',
  'restedness'
] as const;

export type ObservationCandidateKind = (typeof OBSERVATION_CANDIDATE_KINDS)[number];
export type ObservationSubject = (typeof OBSERVATION_SUBJECTS)[number];
export type ObservationAssertion = (typeof OBSERVATION_ASSERTIONS)[number];
export type ObservationReportingMode = (typeof OBSERVATION_REPORTING_MODES)[number];
export type ObservationEvidenceMode = (typeof OBSERVATION_EVIDENCE_MODES)[number];
export type ObservationTemporalScope = (typeof OBSERVATION_TEMPORAL_SCOPES)[number];
export type ObservationTemporalPrecision = (typeof OBSERVATION_TEMPORAL_PRECISIONS)[number];
export type MoodCoverage = (typeof MOOD_COVERAGES)[number];
export type SleepQuality = (typeof SLEEP_QUALITIES)[number];
export type SleepRestedness = (typeof SLEEP_RESTEDNESS_VALUES)[number];
export type MoodCorrectionRemovableField = (typeof MOOD_CORRECTION_REMOVABLE_FIELDS)[number];
export type SleepCorrectionRemovableField = (typeof SLEEP_CORRECTION_REMOVABLE_FIELDS)[number];
export type ObservationCorrectionRemovableField =
  | MoodCorrectionRemovableField
  | SleepCorrectionRemovableField;

export interface ObservationTemporalReference {
  scope: ObservationTemporalScope;
  precision: ObservationTemporalPrecision;
  startAt?: string;
  endAt?: string;
  originalExpression?: string;
}

export interface MoodObservationData {
  emotions?: readonly string[];
  intensity?: number;
  intensityScaleMax?: number;
  score?: number;
  scoreScaleMax?: number;
  isMixed?: boolean;
  coverage?: MoodCoverage;
  summary?: string;
}

export interface SleepObservationData {
  durationMinutes?: number;
  durationIsApproximate?: boolean;
  fellAsleepAt?: string;
  fellAsleepAtIsApproximate?: boolean;
  wokeAt?: string;
  wokeAtIsApproximate?: boolean;
  awakenings?: number;
  awakeningsIsApproximate?: boolean;
  quality?: SleepQuality;
  qualityIsApproximate?: boolean;
  restedness?: SleepRestedness;
  restednessIsApproximate?: boolean;
  periodDescription?: string;
}

interface ObservationCandidateBase {
  subject: ObservationSubject;
  assertion: ObservationAssertion;
  reportingMode: ObservationReportingMode;
  evidenceMode?: ObservationEvidenceMode;
  sourceQuote: string;
  correctsObservationId?: string;
  temporal: ObservationTemporalReference;
  confidence: number;
  removeFields?: readonly ObservationCorrectionRemovableField[];
}

export interface MoodEventCandidate extends ObservationCandidateBase {
  kind: 'mood_event';
  mood: MoodObservationData;
}

export interface MoodDailySummaryCandidate extends ObservationCandidateBase {
  kind: 'mood_daily_summary';
  mood: MoodObservationData;
}

export interface SleepRecordCandidate extends ObservationCandidateBase {
  kind: 'sleep_record';
  sleep: SleepObservationData;
}

export type ObservationCandidate =
  | MoodEventCandidate
  | MoodDailySummaryCandidate
  | SleepRecordCandidate;

interface RecentStructuredObservationBase {
  observationId: string;
  sourceMessageId: string;
  temporal: ObservationTemporalReference;
}

export interface RecentMoodEventObservation extends RecentStructuredObservationBase {
  kind: 'mood_event';
  mood: MoodObservationData;
}

export interface RecentMoodDailySummaryObservation extends RecentStructuredObservationBase {
  kind: 'mood_daily_summary';
  mood: MoodObservationData;
}

export interface RecentSleepRecordObservation extends RecentStructuredObservationBase {
  kind: 'sleep_record';
  sleep: SleepObservationData;
}

export type RecentStructuredObservation =
  | RecentMoodEventObservation
  | RecentMoodDailySummaryObservation
  | RecentSleepRecordObservation;

export interface ObservationExtractionRequest {
  currentUserMessage: string;
  referenceAt: string;
  timezone: string;
  sourceMessageId: string;
  conversationId: string;
  recentStructuredObservations?: readonly RecentStructuredObservation[];
}

export type ObservationExtractionProvider = 'openai' | 'gemini' | 'noop';

export interface ObservationExtractionResponse {
  trust: 'untrusted_model_output';
  schemaVersion: typeof OBSERVATION_EXTRACTION_SCHEMA_VERSION;
  source: {
    sourceMessageId: string;
    conversationId: string;
  };
  candidates: readonly ObservationCandidate[];
  metadata: {
    provider: ObservationExtractionProvider;
    model: string | null;
    promptVersion: string;
    schemaVersion: typeof OBSERVATION_EXTRACTION_SCHEMA_VERSION;
  };
  usage: LlmUsage;
}

export interface ObservationExtractor {
  extract(request: ObservationExtractionRequest): Promise<ObservationExtractionResponse>;
}
