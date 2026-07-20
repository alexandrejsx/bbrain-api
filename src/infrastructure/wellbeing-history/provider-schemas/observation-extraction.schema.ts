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
  SLEEP_RESTEDNESS_VALUES
} from '../../../use-cases/wellbeing-history/ports/observation-extractor.port';

const nullableStringSchema = {
  type: ['string', 'null']
} as const;

const temporalSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    scope: { type: 'string', enum: OBSERVATION_TEMPORAL_SCOPES },
    precision: { type: 'string', enum: OBSERVATION_TEMPORAL_PRECISIONS },
    startAt: { type: ['string', 'null'] },
    endAt: { type: ['string', 'null'] },
    originalExpression: { type: ['string', 'null'] }
  },
  required: ['scope', 'precision', 'startAt', 'endAt', 'originalExpression']
} as const;

const moodSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    emotions: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 12
    },
    intensity: { type: ['number', 'null'], minimum: 0, maximum: 100 },
    intensityScaleMax: { type: ['number', 'null'], minimum: 0, maximum: 100 },
    score: { type: ['number', 'null'], minimum: 0, maximum: 100 },
    scoreScaleMax: { type: ['number', 'null'], minimum: 0, maximum: 100 },
    isMixed: { type: ['boolean', 'null'] },
    coverage: { type: ['string', 'null'], enum: [...MOOD_COVERAGES, null] },
    summary: nullableStringSchema
  },
  required: [
    'emotions',
    'intensity',
    'intensityScaleMax',
    'score',
    'scoreScaleMax',
    'isMixed',
    'coverage',
    'summary'
  ]
} as const;

const sleepSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    durationMinutes: { type: ['number', 'null'], minimum: 0, maximum: 1440 },
    durationIsApproximate: { type: ['boolean', 'null'] },
    fellAsleepAt: { type: ['string', 'null'] },
    fellAsleepAtIsApproximate: { type: ['boolean', 'null'] },
    wokeAt: { type: ['string', 'null'] },
    wokeAtIsApproximate: { type: ['boolean', 'null'] },
    awakenings: { type: ['integer', 'null'], minimum: 0, maximum: 100 },
    awakeningsIsApproximate: { type: ['boolean', 'null'] },
    quality: { type: ['string', 'null'], enum: [...SLEEP_QUALITIES, null] },
    qualityIsApproximate: { type: ['boolean', 'null'] },
    restedness: { type: ['string', 'null'], enum: [...SLEEP_RESTEDNESS_VALUES, null] },
    restednessIsApproximate: { type: ['boolean', 'null'] },
    periodDescription: nullableStringSchema
  },
  required: [
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
  ]
} as const;

const commonCandidateProperties = {
  subject: { type: 'string', enum: OBSERVATION_SUBJECTS },
  assertion: { type: 'string', enum: OBSERVATION_ASSERTIONS },
  reportingMode: { type: 'string', enum: OBSERVATION_REPORTING_MODES },
  evidenceMode: { type: 'string', enum: OBSERVATION_EVIDENCE_MODES },
  sourceQuote: { type: 'string' },
  correctsObservationId: { type: ['string', 'null'] },
  temporal: temporalSchema,
  confidence: { type: 'number', minimum: 0, maximum: 1 }
} as const;

const commonCandidateRequired = [
  'kind',
  'subject',
  'assertion',
  'reportingMode',
  'evidenceMode',
  'sourceQuote',
  'correctsObservationId',
  'temporal',
  'confidence'
] as const;

const moodCandidateSchema = (kind: 'mood_event' | 'mood_daily_summary') =>
  ({
    type: 'object',
    additionalProperties: false,
    properties: {
      kind: { type: 'string', enum: [kind] },
      ...commonCandidateProperties,
      removeFields: {
        type: 'array',
        items: { type: 'string', enum: MOOD_CORRECTION_REMOVABLE_FIELDS },
        maxItems: MOOD_CORRECTION_REMOVABLE_FIELDS.length
      },
      mood: moodSchema
    },
    required: [...commonCandidateRequired, 'removeFields', 'mood']
  }) as const;

const sleepCandidateSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: { type: 'string', enum: ['sleep_record'] },
    ...commonCandidateProperties,
    removeFields: {
      type: 'array',
      items: { type: 'string', enum: SLEEP_CORRECTION_REMOVABLE_FIELDS },
      maxItems: SLEEP_CORRECTION_REMOVABLE_FIELDS.length
    },
    sleep: sleepSchema
  },
  required: [...commonCandidateRequired, 'removeFields', 'sleep']
} as const;

export const OBSERVATION_EXTRACTION_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    schemaVersion: {
      type: 'string',
      enum: [OBSERVATION_EXTRACTION_SCHEMA_VERSION]
    },
    candidates: {
      type: 'array',
      maxItems: 12,
      items: {
        anyOf: [
          moodCandidateSchema('mood_event'),
          moodCandidateSchema('mood_daily_summary'),
          sleepCandidateSchema
        ]
      }
    }
  },
  required: ['schemaVersion', 'candidates']
} as const;
