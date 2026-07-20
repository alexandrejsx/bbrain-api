import {
  MOOD_COVERAGES,
  MOOD_CORRECTION_REMOVABLE_FIELDS,
  OBSERVATION_ASSERTIONS,
  OBSERVATION_EVIDENCE_MODES,
  OBSERVATION_EXTRACTION_SCHEMA_VERSION,
  OBSERVATION_REPORTING_MODES,
  OBSERVATION_SUBJECTS,
  OBSERVATION_TEMPORAL_PRECISIONS,
  OBSERVATION_TEMPORAL_SCOPES,
  SLEEP_QUALITIES,
  SLEEP_CORRECTION_REMOVABLE_FIELDS,
  SLEEP_RESTEDNESS_VALUES,
  MoodObservationData,
  ObservationCandidate,
  ObservationCorrectionRemovableField,
  ObservationExtractionRequest,
  ObservationReportingMode,
  ObservationTemporalReference,
  SleepObservationData
} from '../../../use-cases/wellbeing-history/ports/observation-extractor.port';
import { isStrictOffsetDateTime } from '../../../use-cases/wellbeing-history/strict-iso-datetime';

const ROOT_KEYS = ['schemaVersion', 'candidates'] as const;
const COMMON_CANDIDATE_KEYS = [
  'kind',
  'subject',
  'assertion',
  'reportingMode',
  'evidenceMode',
  'sourceQuote',
  'correctsObservationId',
  'temporal',
  'confidence',
  'removeFields'
] as const;
const TEMPORAL_KEYS = ['scope', 'precision', 'startAt', 'endAt', 'originalExpression'] as const;
const MOOD_KEYS = [
  'emotions',
  'intensity',
  'intensityScaleMax',
  'score',
  'scoreScaleMax',
  'isMixed',
  'coverage',
  'summary'
] as const;
const SLEEP_KEYS = [
  'durationMinutes',
  'durationIsApproximate',
  'fellAsleepAt',
  'fellAsleepAtIsApproximate',
  'wokeAt',
  'wokeAtIsApproximate',
  'awakenings',
  'awakeningsIsApproximate',
  'quality',
  'qualityIsApproximate',
  'restedness',
  'restednessIsApproximate',
  'periodDescription'
] as const;

export interface ParsedObservationExtractionResponse {
  schemaVersion: typeof OBSERVATION_EXTRACTION_SCHEMA_VERSION;
  candidates: ObservationCandidate[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isOneOf = <T extends string>(value: unknown, allowed: readonly T[]): value is T =>
  typeof value === 'string' && allowed.includes(value as T);

const fail = (providerName: string, detail: string): never => {
  throw new Error(`${providerName} returned invalid observation extraction output: ${detail}`);
};

const assertExactKeys = (
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
  context: string,
  providerName: string
): void => {
  const actualKeys = Object.keys(value);

  if (
    actualKeys.length !== expectedKeys.length ||
    expectedKeys.some((expectedKey) => !Object.prototype.hasOwnProperty.call(value, expectedKey))
  ) {
    fail(providerName, `${context} properties do not match the schema`);
  }
};

const stripMarkdownFence = (value: string): string => {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
};

const parseRoot = (outputText: string, providerName: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(stripMarkdownFence(outputText));

    if (isRecord(parsed)) {
      return parsed;
    }

    return fail(providerName, 'top-level value must be an object');
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${providerName} returned invalid`)) {
      throw error;
    }

    return fail(providerName, 'malformed JSON');
  }
};

const toNullableString = (
  value: unknown,
  maxLength: number,
  field: string,
  providerName: string
): string | undefined => {
  if (value === null) {
    return undefined;
  }

  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    return fail(providerName, `${field} must be a bounded string or null`);
  }

  return value.trim();
};

const toNullableNumber = (
  value: unknown,
  minimum: number,
  maximum: number,
  field: string,
  providerName: string,
  integer = false
): number | undefined => {
  if (value === null) {
    return undefined;
  }

  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum ||
    (integer && !Number.isInteger(value))
  ) {
    return fail(providerName, `${field} must be a bounded number or null`);
  }

  return value;
};

const toNullableBoolean = (
  value: unknown,
  field: string,
  providerName: string
): boolean | undefined => {
  if (value === null) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    return fail(providerName, `${field} must be a boolean or null`);
  }

  return value;
};

const isIsoDate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`));

const isIsoDateOrOffsetDateTime = (value: string): boolean =>
  isIsoDate(value) || isStrictOffsetDateTime(value);

const parseTemporal = (
  value: unknown,
  currentUserMessage: string,
  sourceQuote: string,
  providerName: string
): ObservationTemporalReference => {
  if (!isRecord(value)) {
    return fail(providerName, 'temporal must be an object');
  }

  assertExactKeys(value, TEMPORAL_KEYS, 'temporal', providerName);

  if (!isOneOf(value.scope, OBSERVATION_TEMPORAL_SCOPES)) {
    return fail(providerName, 'temporal.scope is invalid');
  }

  if (!isOneOf(value.precision, OBSERVATION_TEMPORAL_PRECISIONS)) {
    return fail(providerName, 'temporal.precision is invalid');
  }

  const startAt = toNullableString(value.startAt, 64, 'temporal.startAt', providerName);
  const endAt = toNullableString(value.endAt, 64, 'temporal.endAt', providerName);
  const originalExpression = toNullableString(
    value.originalExpression,
    160,
    'temporal.originalExpression',
    providerName
  );

  if (startAt && !isIsoDateOrOffsetDateTime(startAt)) {
    return fail(providerName, 'temporal.startAt must be ISO-8601');
  }

  if (endAt && !isIsoDateOrOffsetDateTime(endAt)) {
    return fail(providerName, 'temporal.endAt must be ISO-8601');
  }

  if (startAt && endAt && Date.parse(endAt) < Date.parse(startAt)) {
    return fail(providerName, 'temporal interval is inverted');
  }

  if (originalExpression && !currentUserMessage.includes(originalExpression)) {
    return fail(providerName, 'temporal.originalExpression is not from the current message');
  }

  if (originalExpression && !sourceQuote.includes(originalExpression)) {
    return fail(providerName, 'temporal.originalExpression is outside the candidate quote');
  }

  if ((startAt || endAt || value.precision === 'relative') && !originalExpression) {
    return fail(providerName, 'resolved or relative temporal data requires literal evidence');
  }

  if (value.scope === 'moment' && (!startAt || !isStrictOffsetDateTime(startAt) || endAt)) {
    return fail(providerName, 'temporal moment requires one offset-aware datetime');
  }

  if (
    value.scope === 'interval' &&
    (!startAt || !endAt || !isStrictOffsetDateTime(startAt) || !isStrictOffsetDateTime(endAt))
  ) {
    return fail(providerName, 'temporal interval requires two offset-aware datetimes');
  }

  return {
    scope: value.scope,
    precision: value.precision,
    startAt,
    endAt,
    originalExpression
  };
};

const parseEmotions = (value: unknown, providerName: string): string[] => {
  if (!Array.isArray(value) || value.length > 12) {
    return fail(providerName, 'mood.emotions must be a bounded array');
  }

  return value.map((emotion) => {
    if (typeof emotion !== 'string' || !emotion.trim() || emotion.length > 80) {
      return fail(providerName, 'mood.emotions contains an invalid value');
    }

    return emotion.trim();
  });
};

const parseMood = (
  value: unknown,
  providerName: string,
  allowEmpty = false
): MoodObservationData => {
  if (!isRecord(value)) {
    return fail(providerName, 'mood must be an object');
  }

  assertExactKeys(value, MOOD_KEYS, 'mood', providerName);
  const emotions = parseEmotions(value.emotions, providerName);
  const intensity = toNullableNumber(value.intensity, 0, 100, 'mood.intensity', providerName);
  const intensityScaleMax = toNullableNumber(
    value.intensityScaleMax,
    Number.EPSILON,
    100,
    'mood.intensityScaleMax',
    providerName
  );
  const score = toNullableNumber(value.score, 0, 100, 'mood.score', providerName);
  const scoreScaleMax = toNullableNumber(
    value.scoreScaleMax,
    Number.EPSILON,
    100,
    'mood.scoreScaleMax',
    providerName
  );
  const isMixed = toNullableBoolean(value.isMixed, 'mood.isMixed', providerName);
  const summary = toNullableString(value.summary, 500, 'mood.summary', providerName);

  if (value.coverage !== null && !isOneOf(value.coverage, MOOD_COVERAGES)) {
    return fail(providerName, 'mood.coverage is invalid');
  }

  if ((intensity === undefined) !== (intensityScaleMax === undefined)) {
    return fail(providerName, 'mood intensity requires its explicit scale');
  }

  if (intensity !== undefined && intensityScaleMax !== undefined && intensity > intensityScaleMax) {
    return fail(providerName, 'mood intensity exceeds its scale');
  }

  if ((score === undefined) !== (scoreScaleMax === undefined)) {
    return fail(providerName, 'mood score requires its explicit scale');
  }

  if (score !== undefined && scoreScaleMax !== undefined && score > scoreScaleMax) {
    return fail(providerName, 'mood score exceeds its scale');
  }

  if (emotions.length === 0 && intensity === undefined && score === undefined && isMixed !== true) {
    if (!allowEmpty) return fail(providerName, 'mood candidate contains no observation data');
  }

  return {
    ...(emotions.length ? { emotions } : {}),
    ...(intensity === undefined ? {} : { intensity }),
    ...(intensityScaleMax === undefined ? {} : { intensityScaleMax }),
    ...(score === undefined ? {} : { score }),
    ...(scoreScaleMax === undefined ? {} : { scoreScaleMax }),
    ...(isMixed === undefined ? {} : { isMixed }),
    ...(value.coverage === null ? {} : { coverage: value.coverage }),
    ...(summary === undefined ? {} : { summary })
  };
};

const parseSleep = (
  value: unknown,
  providerName: string,
  allowEmpty = false
): SleepObservationData => {
  if (!isRecord(value)) {
    return fail(providerName, 'sleep must be an object');
  }

  assertExactKeys(value, SLEEP_KEYS, 'sleep', providerName);
  const durationMinutes = toNullableNumber(
    value.durationMinutes,
    0,
    1440,
    'sleep.durationMinutes',
    providerName,
    true
  );
  const durationIsApproximate = toNullableBoolean(
    value.durationIsApproximate,
    'sleep.durationIsApproximate',
    providerName
  );
  const fellAsleepAt = toNullableString(value.fellAsleepAt, 64, 'sleep.fellAsleepAt', providerName);
  const fellAsleepAtIsApproximate = toNullableBoolean(
    value.fellAsleepAtIsApproximate,
    'sleep.fellAsleepAtIsApproximate',
    providerName
  );
  const wokeAt = toNullableString(value.wokeAt, 64, 'sleep.wokeAt', providerName);
  const wokeAtIsApproximate = toNullableBoolean(
    value.wokeAtIsApproximate,
    'sleep.wokeAtIsApproximate',
    providerName
  );
  const awakenings = toNullableNumber(
    value.awakenings,
    0,
    100,
    'sleep.awakenings',
    providerName,
    true
  );
  const awakeningsIsApproximate = toNullableBoolean(
    value.awakeningsIsApproximate,
    'sleep.awakeningsIsApproximate',
    providerName
  );
  const qualityIsApproximate = toNullableBoolean(
    value.qualityIsApproximate,
    'sleep.qualityIsApproximate',
    providerName
  );
  const restednessIsApproximate = toNullableBoolean(
    value.restednessIsApproximate,
    'sleep.restednessIsApproximate',
    providerName
  );
  const periodDescription = toNullableString(
    value.periodDescription,
    500,
    'sleep.periodDescription',
    providerName
  );

  if (fellAsleepAt && !isStrictOffsetDateTime(fellAsleepAt)) {
    return fail(providerName, 'sleep.fellAsleepAt must be ISO-8601');
  }

  if (wokeAt && !isStrictOffsetDateTime(wokeAt)) {
    return fail(providerName, 'sleep.wokeAt must be ISO-8601');
  }

  if ((durationMinutes === undefined) !== (durationIsApproximate === undefined)) {
    return fail(providerName, 'sleep duration requires its approximation flag');
  }

  if ((fellAsleepAt === undefined) !== (fellAsleepAtIsApproximate === undefined)) {
    return fail(providerName, 'sleep start time requires its approximation flag');
  }

  if ((wokeAt === undefined) !== (wokeAtIsApproximate === undefined)) {
    return fail(providerName, 'sleep wake time requires its approximation flag');
  }

  if ((awakenings === undefined) !== (awakeningsIsApproximate === undefined)) {
    return fail(providerName, 'sleep awakenings require their approximation flag');
  }

  if ((value.quality === null) !== (qualityIsApproximate === undefined)) {
    return fail(providerName, 'sleep quality requires its approximation flag');
  }

  if ((value.restedness === null) !== (restednessIsApproximate === undefined)) {
    return fail(providerName, 'sleep restedness requires its approximation flag');
  }

  if (value.quality !== null && !isOneOf(value.quality, SLEEP_QUALITIES)) {
    return fail(providerName, 'sleep.quality is invalid');
  }

  if (value.restedness !== null && !isOneOf(value.restedness, SLEEP_RESTEDNESS_VALUES)) {
    return fail(providerName, 'sleep.restedness is invalid');
  }

  if (
    durationMinutes === undefined &&
    fellAsleepAt === undefined &&
    wokeAt === undefined &&
    awakenings === undefined &&
    value.quality === null &&
    value.restedness === null
  ) {
    if (!allowEmpty) return fail(providerName, 'sleep candidate contains no observation data');
  }

  return {
    ...(durationMinutes === undefined ? {} : { durationMinutes }),
    ...(durationIsApproximate === undefined ? {} : { durationIsApproximate }),
    ...(fellAsleepAt === undefined ? {} : { fellAsleepAt }),
    ...(fellAsleepAtIsApproximate === undefined ? {} : { fellAsleepAtIsApproximate }),
    ...(wokeAt === undefined ? {} : { wokeAt }),
    ...(wokeAtIsApproximate === undefined ? {} : { wokeAtIsApproximate }),
    ...(awakenings === undefined ? {} : { awakenings }),
    ...(awakeningsIsApproximate === undefined ? {} : { awakeningsIsApproximate }),
    ...(value.quality === null ? {} : { quality: value.quality }),
    ...(qualityIsApproximate === undefined ? {} : { qualityIsApproximate }),
    ...(value.restedness === null ? {} : { restedness: value.restedness }),
    ...(restednessIsApproximate === undefined ? {} : { restednessIsApproximate }),
    ...(periodDescription === undefined ? {} : { periodDescription })
  };
};

const parseRemoveFields = (
  value: unknown,
  kind: string,
  reportingMode: ObservationReportingMode,
  providerName: string
): ObservationCorrectionRemovableField[] => {
  if (!Array.isArray(value)) {
    return fail(providerName, 'candidate.removeFields must be an array');
  }

  const allowed =
    kind === 'sleep_record' ? SLEEP_CORRECTION_REMOVABLE_FIELDS : MOOD_CORRECTION_REMOVABLE_FIELDS;
  if (
    value.length > allowed.length ||
    value.some((field) => !isOneOf(field, allowed)) ||
    new Set(value).size !== value.length
  ) {
    return fail(providerName, 'candidate.removeFields contains an invalid value');
  }

  if (reportingMode !== 'correction' && value.length > 0) {
    return fail(providerName, 'only corrections may remove fields');
  }

  return value as ObservationCorrectionRemovableField[];
};

const assertRemovalsDoNotReplaceValues = (
  removeFields: readonly ObservationCorrectionRemovableField[],
  data: MoodObservationData | SleepObservationData,
  providerName: string
): void => {
  if (removeFields.some((field) => Object.prototype.hasOwnProperty.call(data, field))) {
    fail(providerName, 'candidate cannot remove and replace the same field');
  }
};

const validateCorrectionReference = (
  reportingMode: ObservationReportingMode,
  correctsObservationId: string | undefined,
  request: ObservationExtractionRequest,
  providerName: string
): void => {
  if (reportingMode === 'correction') {
    const knownIds = new Set(
      (request.recentStructuredObservations ?? []).map((observation) => observation.observationId)
    );

    if (!correctsObservationId || !knownIds.has(correctsObservationId)) {
      fail(providerName, 'correction references an unknown observation');
    }

    return;
  }

  if (correctsObservationId) {
    fail(providerName, 'non-correction candidate contains a correction reference');
  }
};

const validateReportingModeForKind = (
  kind: string,
  reportingMode: ObservationReportingMode,
  providerName: string
): void => {
  const allowedByKind: Record<string, readonly ObservationReportingMode[]> = {
    mood_event: ['specific_occurrence', 'period_summary', 'correction'],
    mood_daily_summary: ['daily_summary', 'correction'],
    sleep_record: ['specific_occurrence', 'period_summary', 'correction']
  };

  if (!allowedByKind[kind]?.includes(reportingMode)) {
    fail(providerName, 'candidate reporting mode is inconsistent with its kind');
  }
};

const parseCandidate = (
  value: unknown,
  request: ObservationExtractionRequest,
  providerName: string
): ObservationCandidate => {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return fail(providerName, 'candidate must be a discriminated object');
  }

  const detailKey = value.kind === 'sleep_record' ? 'sleep' : 'mood';
  assertExactKeys(value, [...COMMON_CANDIDATE_KEYS, detailKey], 'candidate', providerName);

  if (!isOneOf(value.subject, OBSERVATION_SUBJECTS)) {
    return fail(providerName, 'candidate.subject is invalid');
  }

  if (!isOneOf(value.assertion, OBSERVATION_ASSERTIONS)) {
    return fail(providerName, 'candidate.assertion is invalid');
  }

  if (!isOneOf(value.reportingMode, OBSERVATION_REPORTING_MODES)) {
    return fail(providerName, 'candidate.reportingMode is invalid');
  }

  if (!isOneOf(value.evidenceMode, OBSERVATION_EVIDENCE_MODES)) {
    return fail(providerName, 'candidate.evidenceMode is invalid');
  }

  if (
    typeof value.sourceQuote !== 'string' ||
    !value.sourceQuote.trim() ||
    value.sourceQuote.length > 500 ||
    !request.currentUserMessage.includes(value.sourceQuote)
  ) {
    return fail(providerName, 'candidate.sourceQuote is not an exact current-message quote');
  }

  const correctsObservationId = toNullableString(
    value.correctsObservationId,
    160,
    'candidate.correctsObservationId',
    providerName
  );
  const temporal = parseTemporal(
    value.temporal,
    request.currentUserMessage,
    value.sourceQuote,
    providerName
  );

  if (
    typeof value.confidence !== 'number' ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1
  ) {
    return fail(providerName, 'candidate.confidence is outside 0..1');
  }

  validateCorrectionReference(value.reportingMode, correctsObservationId, request, providerName);
  validateReportingModeForKind(value.kind, value.reportingMode, providerName);
  const removeFields = parseRemoveFields(
    value.removeFields,
    value.kind,
    value.reportingMode,
    providerName
  );
  const allowEmptyData =
    value.reportingMode === 'correction' &&
    (removeFields.length > 0 || temporal.scope !== 'unknown');

  const common = {
    subject: value.subject,
    assertion: value.assertion,
    reportingMode: value.reportingMode,
    evidenceMode: value.evidenceMode,
    sourceQuote: value.sourceQuote,
    correctsObservationId,
    temporal,
    confidence: value.confidence,
    ...(removeFields.length ? { removeFields } : {})
  };

  if (value.kind === 'mood_event') {
    const mood = parseMood(value.mood, providerName, allowEmptyData);
    assertRemovalsDoNotReplaceValues(removeFields, mood, providerName);
    return {
      kind: value.kind,
      ...common,
      mood
    };
  }

  if (value.kind === 'mood_daily_summary') {
    const mood = parseMood(value.mood, providerName, allowEmptyData);
    assertRemovalsDoNotReplaceValues(removeFields, mood, providerName);
    return {
      kind: value.kind,
      ...common,
      mood
    };
  }

  if (value.kind === 'sleep_record') {
    const sleep = parseSleep(value.sleep, providerName, allowEmptyData);
    assertRemovalsDoNotReplaceValues(removeFields, sleep, providerName);
    return {
      kind: value.kind,
      ...common,
      sleep
    };
  }

  return fail(providerName, 'candidate.kind is invalid');
};

export function parseObservationExtractionResponse(
  outputText: string,
  providerName: string,
  request: ObservationExtractionRequest
): ParsedObservationExtractionResponse {
  const parsed = parseRoot(outputText, providerName);
  assertExactKeys(parsed, ROOT_KEYS, 'root', providerName);

  if (parsed.schemaVersion !== OBSERVATION_EXTRACTION_SCHEMA_VERSION) {
    return fail(providerName, 'schemaVersion is unsupported');
  }

  if (!Array.isArray(parsed.candidates) || parsed.candidates.length > 12) {
    return fail(providerName, 'candidates must be a bounded array');
  }

  return {
    schemaVersion: OBSERVATION_EXTRACTION_SCHEMA_VERSION,
    candidates: parsed.candidates.map((candidate) =>
      parseCandidate(candidate, request, providerName)
    )
  };
}
