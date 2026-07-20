import {
  TemporalReference,
  WellbeingObservationDataByKind,
  WellbeingObservationKind,
  WELLBEING_OBSERVATION_KINDS
} from '../value-objects/wellbeing-observation.types';
import {
  asTemporalReference,
  isNonEmptyText,
  isRecord,
  validateTemporalReference,
  validateWellbeingObservationData
} from '../value-objects/wellbeing-observation.validators';

export type WellbeingCandidateSubject = 'self' | 'third_party' | 'unknown';
export type WellbeingCandidateAssertion =
  | 'affirmed'
  | 'negated'
  | 'hypothetical'
  | 'desired'
  | 'unknown';
export type WellbeingCandidateReportingMode =
  | 'direct_self_report'
  | 'third_party_report'
  | 'inferred'
  | 'unknown';

export interface ConversationCandidateValidationContext {
  sourceMessage: string;
  sourceMessageId: string;
  conversationId: string;
  modelRef: string;
  promptRef: string;
  schemaRef: string;
}

export type ValidatedWellbeingCandidate<
  K extends WellbeingObservationKind = WellbeingObservationKind
> = {
  kind: K;
  data: WellbeingObservationDataByKind[K];
  temporalReference: TemporalReference;
  correctsObservationId?: string;
  removeFields?: readonly string[];
  provenance: {
    source: 'conversation_extraction';
    sourceMessageId: string;
    conversationId: string;
    evidenceQuote: string;
    confidence: number;
    modelRef: string;
    promptRef: string;
    schemaRef: string;
    correctsObservationId?: string;
  };
};

export type WellbeingCandidateRejectionReason =
  | 'invalid_candidate'
  | 'subject_not_self'
  | 'assertion_not_affirmed'
  | 'reporting_mode_not_direct_self_report'
  | 'invalid_confidence'
  | 'confidence_below_threshold'
  | 'evidence_quote_missing'
  | 'evidence_quote_not_literal'
  | 'numeric_field_not_grounded_in_evidence'
  | 'invalid_temporal_reference'
  | 'invalid_variant'
  | 'invalid_correction_target'
  | 'invalid_provenance_context';

export type WellbeingCandidateValidationResult =
  | {
      accepted: true;
      candidate: ValidatedWellbeingCandidate;
    }
  | {
      accepted: false;
      reasons: readonly WellbeingCandidateRejectionReason[];
    };

const CANDIDATE_KEYS = [
  'subject',
  'assertion',
  'reportingMode',
  'confidence',
  'evidenceQuote',
  'correctsObservationId',
  'removeFields',
  'kind',
  'data',
  'temporalReference'
] as const;

function hasOnlyCandidateKeys(candidate: Record<string, unknown>): boolean {
  const allowedKeys = new Set<string>(CANDIDATE_KEYS);
  return Object.keys(candidate).every((key) => allowedKeys.has(key));
}

function isKind(value: unknown): value is WellbeingObservationKind {
  return WELLBEING_OBSERVATION_KINDS.some((kind) => kind === value);
}

function isValidProvenanceContext(context: ConversationCandidateValidationContext): boolean {
  return (
    typeof context.sourceMessage === 'string' &&
    isNonEmptyText(context.sourceMessageId) &&
    isNonEmptyText(context.conversationId) &&
    isNonEmptyText(context.modelRef) &&
    isNonEmptyText(context.promptRef) &&
    isNonEmptyText(context.schemaRef)
  );
}

function addOnce(
  reasons: WellbeingCandidateRejectionReason[],
  reason: WellbeingCandidateRejectionReason
): void {
  if (!reasons.includes(reason)) reasons.push(reason);
}

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

const REMOVABLE_FIELDS_BY_KIND: Record<WellbeingObservationKind, readonly string[]> = {
  mood_event: ['descriptors', 'isMixed', 'explicitIntensity', 'explicitRating'],
  mood_daily_summary: ['descriptors', 'isMixed', 'explicitIntensity', 'explicitRating'],
  sleep_record: [
    'durationMinutes',
    'quality',
    'bedtime',
    'wakeTime',
    'awakeningCount',
    'wakeFeeling'
  ]
};

function validRemovalFields(candidate: Record<string, unknown>): readonly string[] | undefined {
  if (!('removeFields' in candidate)) return [];
  if (!Array.isArray(candidate.removeFields) || !isKind(candidate.kind)) return undefined;
  const allowed = REMOVABLE_FIELDS_BY_KIND[candidate.kind];
  if (
    candidate.removeFields.length === 0 ||
    new Set(candidate.removeFields).size !== candidate.removeFields.length ||
    candidate.removeFields.some((field) => typeof field !== 'string' || !allowed.includes(field))
  ) {
    return undefined;
  }
  if (!isNonEmptyText(candidate.correctsObservationId)) return undefined;
  return candidate.removeFields as string[];
}

function numericTokens(value: string): number[] {
  return (value.match(/[-+]?\d+(?:[.,]\d+)?/g) ?? [])
    .map((token) => Number(token.replace(',', '.')))
    .filter(Number.isFinite);
}

const EVIDENCE_NUMBER_WORDS = new Map<string, number>([
  ['zero', 0],
  ['um', 1],
  ['uma', 1],
  ['one', 1],
  ['uno', 1],
  ['una', 1],
  ['dois', 2],
  ['duas', 2],
  ['two', 2],
  ['dos', 2],
  ['tres', 3],
  ['three', 3],
  ['quatro', 4],
  ['four', 4],
  ['cuatro', 4],
  ['cinco', 5],
  ['five', 5],
  ['seis', 6],
  ['six', 6],
  ['sete', 7],
  ['seven', 7],
  ['siete', 7],
  ['oito', 8],
  ['eight', 8],
  ['ocho', 8],
  ['nove', 9],
  ['nine', 9],
  ['nueve', 9],
  ['dez', 10],
  ['ten', 10],
  ['diez', 10],
  ['onze', 11],
  ['eleven', 11],
  ['once', 11],
  ['doze', 12],
  ['twelve', 12],
  ['doce', 12]
]);

function normalizeEvidence(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function durationMinutesFromEvidence(quote: string): number[] {
  const normalized = normalizeEvidence(quote);
  const durations: number[] = [];
  const numericDuration = /([-+]?\d+(?:[.,]\d+)?)\s*(horas?|hours?|hrs?|min(?:utos?)?|minutes?)/g;
  let match: RegExpExecArray | null;

  while ((match = numericDuration.exec(normalized))) {
    const value = Number(match[1].replace(',', '.'));
    durations.push(match[2].startsWith('h') ? value * 60 : value);
  }

  for (const [word, value] of EVIDENCE_NUMBER_WORDS) {
    if (new RegExp(`\\b${word}\\s+(?:horas?|hours?|min(?:utos?)?|minutes?)\\b`).test(normalized)) {
      const isMinutes = new RegExp(`\\b${word}\\s+(?:min(?:utos?)?|minutes?)\\b`).test(normalized);
      durations.push(isMinutes ? value : value * 60);
    }
  }

  if (/\b(?:meia hora|half an hour|media hora)\b/.test(normalized)) durations.push(30);
  return durations;
}

function numberRepresentations(value: number): string[] {
  return [
    String(value),
    ...[...EVIDENCE_NUMBER_WORDS.entries()]
      .filter(([, mappedValue]) => mappedValue === value)
      .map(([word]) => word)
  ];
}

function hasAwakeningCountEvidence(quote: string, count: number): boolean {
  const normalized = normalizeEvidence(quote);
  const marker = '(?:acord\\w*|despert\\w*|woke|wake|awaken\\w*)';

  return numberRepresentations(count).some((representation) => {
    const escaped = representation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (
      new RegExp(`${marker}[^.!?,;]{0,32}\\b${escaped}\\b\\s*(?:vez(?:es)?|times?|x\\b)`).test(
        normalized
      ) ||
      new RegExp(`\\b${escaped}\\b\\s*(?:vez(?:es)?|times?|despertar(?:es)?|awakenings?)\\b`).test(
        normalized
      )
    );
  });
}

function explicitMoodNumbers(data: unknown): number[] {
  if (!isRecord(data)) return [];

  const values: number[] = [];
  for (const field of ['explicitIntensity', 'explicitRating'] as const) {
    const rating = data[field];
    if (!isRecord(rating)) continue;

    if (typeof rating.value === 'number' && Number.isFinite(rating.value)) {
      values.push(rating.value);
    }
    if (typeof rating.scaleMin === 'number' && Number.isFinite(rating.scaleMin)) {
      values.push(rating.scaleMin);
    }
    if (typeof rating.scaleMax === 'number' && Number.isFinite(rating.scaleMax)) {
      values.push(rating.scaleMax);
    }
  }

  return values;
}

/**
 * Numeric mood fields are falsifiable facts. Every value and declared scale boundary must have
 * its own literal numeric token in the evidence quote; a model confidence score is not evidence.
 */
function hasGroundedExplicitMoodNumbers(candidate: Record<string, unknown>): boolean {
  if (candidate.kind !== 'mood_event' && candidate.kind !== 'mood_daily_summary') return true;
  if (typeof candidate.evidenceQuote !== 'string') return false;

  const remainingTokens = numericTokens(candidate.evidenceQuote);
  for (const requiredValue of explicitMoodNumbers(candidate.data)) {
    const matchIndex = remainingTokens.findIndex(
      (token) => Math.abs(token - requiredValue) <= Number.EPSILON
    );
    if (matchIndex < 0) return false;
    remainingTokens.splice(matchIndex, 1);
  }

  return true;
}

function hasGroundedSleepNumbers(candidate: Record<string, unknown>): boolean {
  if (candidate.kind !== 'sleep_record' || !isRecord(candidate.data)) return true;
  if (typeof candidate.evidenceQuote !== 'string') return false;

  const duration = candidate.data.durationMinutes;
  if (isRecord(duration) && typeof duration.value === 'number') {
    const durationValue = duration.value;
    const supportedDurations = durationMinutesFromEvidence(candidate.evidenceQuote);
    if (!supportedDurations.some((value) => Math.abs(value - durationValue) <= Number.EPSILON)) {
      return false;
    }
  }

  const awakenings = candidate.data.awakeningCount;
  if (
    isRecord(awakenings) &&
    typeof awakenings.value === 'number' &&
    !hasAwakeningCountEvidence(candidate.evidenceQuote, awakenings.value)
  ) {
    return false;
  }

  return true;
}

export class WellbeingCandidateValidationPolicy {
  constructor(readonly minimumConfidence = 0.8) {
    if (!Number.isFinite(minimumConfidence) || minimumConfidence < 0 || minimumConfidence > 1) {
      throw new Error('minimumConfidence must be between 0 and 1');
    }
  }

  validate(
    candidate: unknown,
    context: ConversationCandidateValidationContext
  ): WellbeingCandidateValidationResult {
    if (!isRecord(candidate)) {
      return { accepted: false, reasons: ['invalid_candidate'] };
    }

    const reasons: WellbeingCandidateRejectionReason[] = [];

    if (!hasOnlyCandidateKeys(candidate)) addOnce(reasons, 'invalid_candidate');
    if (candidate.subject !== 'self') addOnce(reasons, 'subject_not_self');
    if (candidate.assertion !== 'affirmed') addOnce(reasons, 'assertion_not_affirmed');
    if (candidate.reportingMode !== 'direct_self_report') {
      addOnce(reasons, 'reporting_mode_not_direct_self_report');
    }

    if (
      typeof candidate.confidence !== 'number' ||
      !Number.isFinite(candidate.confidence) ||
      candidate.confidence < 0 ||
      candidate.confidence > 1
    ) {
      addOnce(reasons, 'invalid_confidence');
    } else if (candidate.confidence < this.minimumConfidence) {
      addOnce(reasons, 'confidence_below_threshold');
    }

    if (!isNonEmptyText(candidate.evidenceQuote)) {
      addOnce(reasons, 'evidence_quote_missing');
    } else if (!context.sourceMessage.includes(candidate.evidenceQuote)) {
      addOnce(reasons, 'evidence_quote_not_literal');
    }

    if (!hasGroundedExplicitMoodNumbers(candidate) || !hasGroundedSleepNumbers(candidate)) {
      addOnce(reasons, 'numeric_field_not_grounded_in_evidence');
    }

    if ('correctsObservationId' in candidate && !isNonEmptyText(candidate.correctsObservationId)) {
      addOnce(reasons, 'invalid_correction_target');
    }
    const removeFields = validRemovalFields(candidate);
    if (removeFields === undefined) addOnce(reasons, 'invalid_variant');

    if (!isKind(candidate.kind)) {
      addOnce(reasons, 'invalid_variant');
    } else if (validateWellbeingObservationData(candidate.kind, candidate.data).length > 0) {
      const isCorrectionPatchWithoutData =
        isNonEmptyText(candidate.correctsObservationId) &&
        isRecord(candidate.data) &&
        Object.keys(candidate.data).length === 0 &&
        (Boolean(removeFields?.length) ||
          (isRecord(candidate.temporalReference) &&
            candidate.temporalReference.kind !== 'unknown'));
      if (!isCorrectionPatchWithoutData) addOnce(reasons, 'invalid_variant');
    } else if (
      candidate.kind === 'mood_daily_summary' &&
      isRecord(candidate.data) &&
      candidate.data.summarySource === 'manual_override'
    ) {
      addOnce(reasons, 'invalid_variant');
    }

    if (validateTemporalReference(candidate.temporalReference).length > 0) {
      addOnce(reasons, 'invalid_temporal_reference');
    }

    if (!isValidProvenanceContext(context)) addOnce(reasons, 'invalid_provenance_context');

    if (reasons.length > 0) return { accepted: false, reasons };

    const kind = candidate.kind as WellbeingObservationKind;
    const correctsObservationId = candidate.correctsObservationId as string | undefined;
    const provenance = {
      source: 'conversation_extraction' as const,
      sourceMessageId: context.sourceMessageId,
      conversationId: context.conversationId,
      evidenceQuote: candidate.evidenceQuote as string,
      confidence: candidate.confidence as number,
      modelRef: context.modelRef,
      promptRef: context.promptRef,
      schemaRef: context.schemaRef,
      ...(correctsObservationId ? { correctsObservationId } : {})
    };
    return {
      accepted: true,
      candidate: {
        kind,
        data: clone(candidate.data) as WellbeingObservationDataByKind[typeof kind],
        temporalReference: clone(asTemporalReference(candidate.temporalReference)),
        ...(correctsObservationId ? { correctsObservationId } : {}),
        ...(removeFields?.length ? { removeFields: [...removeFields] } : {}),
        provenance
      }
    };
  }
}
