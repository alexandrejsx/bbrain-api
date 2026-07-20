import {
  InitialWellbeingObservationProvenance,
  TemporalReference,
  WellbeingObservationKind,
  WellbeingObservationProvenanceHistory
} from './wellbeing-observation.types';

type UnknownRecord = Record<string, unknown>;

const ISO_LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export const MAX_EMBEDDED_WELLBEING_REVISIONS = 500;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isBoundedText(value: unknown, maxLength: number): value is string {
  return isNonEmptyText(value) && value.length <= maxLength;
}

export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function unexpectedKeys(record: UnknownRecord, allowedKeys: readonly string[]): string[] {
  const allowed = new Set(allowedKeys);
  return Object.keys(record)
    .filter((key) => !allowed.has(key))
    .map((key) => `unexpected field: ${key}`);
}

function isLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_LOCAL_DATE.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function validatePrecision(value: unknown, path: string): string[] {
  return value === 'exact' || value === 'approximate' ? [] : [`${path} is invalid`];
}

function validateTimezone(value: unknown): string[] {
  if (!isBoundedText(value, 64)) return ['temporalReference.timezone is invalid'];

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return [];
  } catch {
    return ['temporalReference.timezone is invalid'];
  }
}

function validateConversationProvenance(
  value: UnknownRecord,
  requireCorrectionTarget: boolean
): string[] {
  const allowedKeys = [
    'source',
    'sourceMessageId',
    'conversationId',
    'evidenceFingerprint',
    'confidence',
    'modelRef',
    'promptRef',
    'schemaRef',
    ...(requireCorrectionTarget ? ['correctsObservationId'] : [])
  ];
  const errors = unexpectedKeys(value, allowedKeys).map((error) => `provenance.${error}`);

  for (const field of [
    'sourceMessageId',
    'conversationId',
    'evidenceFingerprint',
    'modelRef',
    'promptRef',
    'schemaRef'
  ] as const) {
    const maxLength = field === 'evidenceFingerprint' ? 64 : 160;
    if (!isBoundedText(value[field], maxLength)) {
      errors.push(`provenance.${field} is required or too long`);
    }
  }
  if (
    typeof value.evidenceFingerprint === 'string' &&
    !/^[a-f0-9]{64}$/u.test(value.evidenceFingerprint)
  ) {
    errors.push('provenance.evidenceFingerprint must be a 64-character fingerprint');
  }
  if (requireCorrectionTarget && !isBoundedText(value.correctsObservationId, 160)) {
    errors.push('provenance.correctsObservationId is required');
  }

  if (
    typeof value.confidence !== 'number' ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1
  ) {
    errors.push('provenance.confidence must be between 0 and 1');
  }

  return errors;
}

function validatePrecisionPreservedValue(
  value: unknown,
  path: string,
  validateValue: (value: unknown) => boolean
): string[] {
  if (!isRecord(value)) return [`${path} must be an object`];

  const errors = unexpectedKeys(value, ['value', 'precision']).map((error) => `${path}.${error}`);

  if (!validateValue(value.value)) errors.push(`${path}.value is invalid`);
  errors.push(...validatePrecision(value.precision, `${path}.precision`));

  return errors;
}

function validateMoodFields(record: UnknownRecord): string[] {
  const errors: string[] = [];

  if ('descriptors' in record) {
    if (
      !Array.isArray(record.descriptors) ||
      record.descriptors.length === 0 ||
      record.descriptors.length > 12 ||
      record.descriptors.some((descriptor) => !isBoundedText(descriptor, 80))
    ) {
      errors.push('data.descriptors must contain non-empty descriptors');
    }
  }

  if ('intensityDescriptor' in record && !isBoundedText(record.intensityDescriptor, 160)) {
    errors.push('data.intensityDescriptor must be non-empty');
  }

  if ('isMixed' in record && record.isMixed !== true) {
    errors.push('data.isMixed must be true when explicitly reported');
  }

  for (const field of ['explicitRating', 'explicitIntensity'] as const) {
    if (!(field in record)) continue;

    if (!isRecord(record[field])) {
      errors.push(`data.${field} must be an object`);
    } else {
      const rating = record[field];
      errors.push(
        ...unexpectedKeys(rating, ['value', 'scaleMin', 'scaleMax']).map(
          (error) => `data.${field}.${error}`
        )
      );

      if (
        typeof rating.value !== 'number' ||
        !Number.isFinite(rating.value) ||
        typeof rating.scaleMax !== 'number' ||
        !Number.isFinite(rating.scaleMax) ||
        rating.scaleMax <= 0 ||
        rating.scaleMax > 100 ||
        ('scaleMin' in rating &&
          (typeof rating.scaleMin !== 'number' ||
            !Number.isFinite(rating.scaleMin) ||
            rating.scaleMin >= rating.scaleMax ||
            rating.value < rating.scaleMin)) ||
        rating.value > rating.scaleMax
      ) {
        errors.push(`data.${field} must have a value inside a valid explicit scale`);
      }
    }
  }

  if (
    !('descriptors' in record) &&
    !('isMixed' in record) &&
    !('explicitRating' in record) &&
    !('explicitIntensity' in record)
  ) {
    errors.push(
      'mood data requires descriptors, an explicit mixed report, an explicit rating and/or explicit intensity'
    );
  }

  return errors;
}

function validateMoodEventData(data: unknown): string[] {
  if (!isRecord(data)) return ['data must be an object'];

  return [
    ...unexpectedKeys(data, [
      'descriptors',
      'isMixed',
      'intensityDescriptor',
      'explicitIntensity',
      'explicitRating'
    ]).map((error) => `data.${error}`),
    ...validateMoodFields(data)
  ];
}

function validateMoodDailySummaryData(data: unknown): string[] {
  if (!isRecord(data)) return ['data must be an object'];

  const errors = [
    ...unexpectedKeys(data, [
      'descriptors',
      'isMixed',
      'intensityDescriptor',
      'explicitIntensity',
      'explicitRating',
      'sourceObservationIds',
      'sourceObservationVersions',
      'coverage',
      'status',
      'summarySource',
      'staleReason'
    ]).map((error) => `data.${error}`),
    ...validateMoodFields(data)
  ];

  const sourceObservationIds = data.sourceObservationIds;
  if (
    !Array.isArray(sourceObservationIds) ||
    sourceObservationIds.length > 200 ||
    sourceObservationIds.some((id) => !isBoundedText(id, 160)) ||
    new Set(sourceObservationIds).size !== sourceObservationIds.length
  ) {
    errors.push('data.sourceObservationIds must be a unique list of non-empty ids');
  }

  const sourceObservationVersions = data.sourceObservationVersions;
  if (sourceObservationVersions !== undefined) {
    if (
      !Array.isArray(sourceObservationVersions) ||
      sourceObservationVersions.length > 200 ||
      sourceObservationVersions.some(
        (version) =>
          !isRecord(version) ||
          !isBoundedText(version.observationId, 160) ||
          typeof version.revision !== 'number' ||
          !Number.isInteger(version.revision) ||
          version.revision < 1 ||
          unexpectedKeys(version, ['observationId', 'revision']).length > 0
      ) ||
      new Set(
        sourceObservationVersions.filter(isRecord).map((version) => String(version.observationId))
      ).size !== sourceObservationVersions.length
    ) {
      errors.push('data.sourceObservationVersions must contain unique valid source revisions');
    }
  }

  if (!['partial', 'sufficient', 'unknown'].includes(String(data.coverage))) {
    errors.push('data.coverage is invalid');
  }

  if (!['current', 'stale'].includes(String(data.status))) {
    errors.push('data.status is invalid');
  }

  if (!['derived', 'user_explicit', 'manual_override'].includes(String(data.summarySource))) {
    errors.push('data.summarySource is invalid');
  }

  if (
    data.summarySource === 'derived' &&
    Array.isArray(sourceObservationIds) &&
    sourceObservationIds.length === 0
  ) {
    errors.push('derived summaries require source observations');
  }

  if (
    data.summarySource === 'derived' &&
    Array.isArray(sourceObservationIds) &&
    (!Array.isArray(sourceObservationVersions) ||
      sourceObservationVersions.length !== sourceObservationIds.length ||
      sourceObservationIds.some(
        (id) =>
          !sourceObservationVersions.some(
            (version) => isRecord(version) && version.observationId === id
          )
      ))
  ) {
    errors.push('derived summaries require the revision of every source observation');
  }

  if (data.status === 'stale' && !isBoundedText(data.staleReason, 160)) {
    errors.push('stale summaries require a stale reason');
  }

  if (data.status === 'current' && 'staleReason' in data) {
    errors.push('current summaries cannot have a stale reason');
  }

  if (data.summarySource === 'manual_override' && data.status !== 'current') {
    errors.push('manual overrides must remain current');
  }

  return errors;
}

function validateSleepRecordData(data: unknown): string[] {
  if (!isRecord(data)) return ['data must be an object'];

  const allowedFields = [
    'durationMinutes',
    'quality',
    'bedtime',
    'wakeTime',
    'awakeningCount',
    'wakeFeeling'
  ] as const;
  const errors = unexpectedKeys(data, allowedFields).map((error) => `data.${error}`);
  const presentFields = allowedFields.filter((field) => data[field] !== undefined);

  if (presentFields.length === 0) {
    errors.push('sleep data requires at least one reported field');
    return errors;
  }

  if ('durationMinutes' in data) {
    errors.push(
      ...validatePrecisionPreservedValue(
        data.durationMinutes,
        'data.durationMinutes',
        (value) =>
          typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 1440
      )
    );
  }

  if ('quality' in data) {
    errors.push(
      ...validatePrecisionPreservedValue(data.quality, 'data.quality', (value) =>
        isBoundedText(value, 80)
      )
    );
  }

  if ('bedtime' in data) {
    errors.push(
      ...validatePrecisionPreservedValue(
        data.bedtime,
        'data.bedtime',
        (value) => typeof value === 'string' && LOCAL_TIME.test(value)
      )
    );
  }

  if ('wakeTime' in data) {
    errors.push(
      ...validatePrecisionPreservedValue(
        data.wakeTime,
        'data.wakeTime',
        (value) => typeof value === 'string' && LOCAL_TIME.test(value)
      )
    );
  }

  if ('awakeningCount' in data) {
    errors.push(
      ...validatePrecisionPreservedValue(
        data.awakeningCount,
        'data.awakeningCount',
        (value) =>
          typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100
      )
    );
  }

  if ('wakeFeeling' in data) {
    errors.push(
      ...validatePrecisionPreservedValue(data.wakeFeeling, 'data.wakeFeeling', (value) =>
        isBoundedText(value, 80)
      )
    );
  }

  return errors;
}

export function validateWellbeingObservationData(
  kind: WellbeingObservationKind,
  data: unknown
): string[] {
  switch (kind) {
    case 'mood_event':
      return validateMoodEventData(data);
    case 'mood_daily_summary':
      return validateMoodDailySummaryData(data);
    case 'sleep_record':
      return validateSleepRecordData(data);
  }
}

export function validateTemporalReference(value: unknown): string[] {
  if (!isRecord(value)) return ['temporalReference must be an object'];

  const errors = validateTimezone(value.timezone);

  switch (value.kind) {
    case 'moment':
      errors.push(
        ...unexpectedKeys(value, ['kind', 'timezone', 'precision', 'at']).map(
          (error) => `temporalReference.${error}`
        ),
        ...validatePrecision(value.precision, 'temporalReference.precision')
      );
      if (!isValidDate(value.at)) errors.push('temporalReference.at must be a valid date');
      break;
    case 'specific_day':
    case 'specific_night':
      errors.push(
        ...unexpectedKeys(value, ['kind', 'timezone', 'precision', 'localDate']).map(
          (error) => `temporalReference.${error}`
        ),
        ...validatePrecision(value.precision, 'temporalReference.precision')
      );
      if (!isLocalDate(value.localDate)) {
        errors.push('temporalReference.localDate must be a valid local ISO date');
      }
      break;
    case 'interval':
      errors.push(
        ...unexpectedKeys(value, ['kind', 'timezone', 'precision', 'startsAt', 'endsAt']).map(
          (error) => `temporalReference.${error}`
        ),
        ...validatePrecision(value.precision, 'temporalReference.precision')
      );
      if (!isValidDate(value.startsAt) || !isValidDate(value.endsAt)) {
        errors.push('temporalReference interval boundaries must be valid dates');
      } else if (value.startsAt > value.endsAt) {
        errors.push('temporalReference interval cannot end before it starts');
      }
      break;
    case 'period': {
      errors.push(
        ...unexpectedKeys(value, [
          'kind',
          'timezone',
          'precision',
          'startsOn',
          'endsOn',
          'descriptor'
        ]).map((error) => `temporalReference.${error}`),
        ...validatePrecision(value.precision, 'temporalReference.precision')
      );
      const hasStart = 'startsOn' in value;
      const hasEnd = 'endsOn' in value;
      const hasDescriptor = 'descriptor' in value;

      if (!hasStart && !hasEnd && !hasDescriptor) {
        errors.push('period temporal references require a boundary or descriptor');
      }
      if (hasStart && !isLocalDate(value.startsOn)) {
        errors.push('temporalReference.startsOn must be a valid local ISO date');
      }
      if (hasEnd && !isLocalDate(value.endsOn)) {
        errors.push('temporalReference.endsOn must be a valid local ISO date');
      }
      if (hasDescriptor && !isBoundedText(value.descriptor, 160)) {
        errors.push('temporalReference.descriptor must be non-empty');
      }
      if (
        isLocalDate(value.startsOn) &&
        isLocalDate(value.endsOn) &&
        value.startsOn > value.endsOn
      ) {
        errors.push('temporalReference period cannot end before it starts');
      }
      break;
    }
    case 'unknown':
      errors.push(
        ...unexpectedKeys(value, ['kind', 'timezone']).map((error) => `temporalReference.${error}`)
      );
      break;
    default:
      errors.push('temporalReference.kind is invalid');
  }

  return errors;
}

export function validateInitialProvenance(value: unknown): string[] {
  if (!isRecord(value)) return ['provenance must be an object'];

  if (value.source === 'manual') {
    return unexpectedKeys(value, ['source']).map((error) => `provenance.${error}`);
  }

  if (value.source === 'derived_projection') {
    const errors = unexpectedKeys(value, ['source', 'projectionRef', 'sourceObservationIds']).map(
      (error) => `provenance.${error}`
    );
    if (!isBoundedText(value.projectionRef, 160)) {
      errors.push('provenance.projectionRef is required');
    }
    if (
      !Array.isArray(value.sourceObservationIds) ||
      value.sourceObservationIds.length === 0 ||
      value.sourceObservationIds.length > 200 ||
      value.sourceObservationIds.some((id) => !isBoundedText(id, 160)) ||
      new Set(value.sourceObservationIds).size !== value.sourceObservationIds.length
    ) {
      errors.push('provenance.sourceObservationIds must contain unique ids');
    }
    return errors;
  }

  if (value.source !== 'conversation_extraction') {
    return ['provenance.source is invalid'];
  }

  return validateConversationProvenance(value, false);
}

export function validateProvenanceHistory(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return ['provenanceHistory must contain an initial provenance'];
  }

  const errors = validateInitialProvenance(value[0]).map((error) => `initial ${error}`);

  value.slice(1).forEach((entry, index) => {
    const path = `provenanceHistory[${index + 1}]`;

    if (!isRecord(entry)) {
      errors.push(`${path} must be a correction provenance`);
      return;
    }

    if (entry.source === 'conversation_extraction') {
      errors.push(
        ...validateConversationProvenance(entry, true).map((error) =>
          error.replace('provenance', path)
        )
      );
      return;
    }

    if (entry.source === 'manual_correction') {
      errors.push(
        ...unexpectedKeys(entry, ['source', 'correctedAt']).map((error) => `${path}.${error}`)
      );
      if (!isValidDate(entry.correctedAt)) errors.push(`${path}.correctedAt must be valid`);
      return;
    }

    errors.push(`${path} must be a conversation or manual correction`);
  });

  return errors;
}

function validateRevisionProvenance(value: unknown, path: string): string[] {
  if (!isRecord(value)) return [`${path}.provenance must be an object`];

  if (value.source === 'manual_correction') {
    const errors = unexpectedKeys(value, ['source', 'correctedAt']).map(
      (error) => `${path}.provenance.${error}`
    );
    if (!isValidDate(value.correctedAt)) {
      errors.push(`${path}.provenance.correctedAt must be valid`);
    }
    return errors;
  }

  if (value.source === 'conversation_extraction' && 'correctsObservationId' in value) {
    return validateConversationProvenance(value, true).map((error) =>
      error.replace('provenance', `${path}.provenance`)
    );
  }

  return validateInitialProvenance(value).map((error) =>
    error.replace('provenance', `${path}.provenance`)
  );
}

function validateRevisionHistory(
  value: unknown,
  kind: WellbeingObservationKind,
  currentRevision: unknown,
  currentUpdatedAt: unknown
): string[] {
  if (!Array.isArray(value)) return ['revisionHistory must be an array'];
  const errors: string[] = [];

  if (value.length > MAX_EMBEDDED_WELLBEING_REVISIONS) {
    errors.push(`revisionHistory cannot exceed ${MAX_EMBEDDED_WELLBEING_REVISIONS} entries`);
  }
  if (
    typeof currentRevision === 'number' &&
    Number.isInteger(currentRevision) &&
    currentRevision >= 1 &&
    value.length !== currentRevision - 1
  ) {
    errors.push('revisionHistory must contain every superseded revision');
  }

  value.forEach((entry, index) => {
    const path = `revisionHistory[${index}]`;
    if (!isRecord(entry)) {
      errors.push(`${path} must be an object`);
      return;
    }

    errors.push(
      ...unexpectedKeys(entry, [
        'revision',
        'data',
        'temporalReference',
        'provenance',
        'operation',
        'updatedAt',
        'supersededAt'
      ]).map((error) => `${path}.${error}`)
    );
    if (entry.revision !== index + 1) {
      errors.push(`${path}.revision must preserve the contiguous revision sequence`);
    }
    errors.push(
      ...validateWellbeingObservationData(kind, entry.data).map((error) => `${path}.${error}`),
      ...validateTemporalReference(entry.temporalReference).map((error) => `${path}.${error}`),
      ...validateRevisionProvenance(entry.provenance, path)
    );
    if (
      ![
        'manual_correction',
        'conversation_correction',
        'projection_marked_stale',
        'projection_restored',
        'projection_refreshed'
      ].includes(String(entry.operation))
    ) {
      errors.push(`${path}.operation is invalid`);
    }
    if (!isValidDate(entry.updatedAt)) errors.push(`${path}.updatedAt must be valid`);
    if (!isValidDate(entry.supersededAt)) errors.push(`${path}.supersededAt must be valid`);
    if (
      isValidDate(entry.updatedAt) &&
      isValidDate(entry.supersededAt) &&
      entry.supersededAt < entry.updatedAt
    ) {
      errors.push(`${path}.supersededAt cannot precede its update`);
    }
    if (
      isValidDate(entry.supersededAt) &&
      isValidDate(currentUpdatedAt) &&
      entry.supersededAt > currentUpdatedAt
    ) {
      errors.push(`${path}.supersededAt cannot follow the current revision`);
    }
  });

  return errors;
}

export function assertValidWellbeingObservationInput(input: {
  userId: unknown;
  idempotencyKey: unknown;
  kind: WellbeingObservationKind;
  data: unknown;
  temporalReference: unknown;
  provenanceHistory: unknown;
  revisionHistory: unknown;
  revision: unknown;
  createdAt: unknown;
  updatedAt: unknown;
}): void {
  const errors: string[] = [];

  if (!isBoundedText(input.userId, 160)) errors.push('userId is required or too long');
  if (!isBoundedText(input.idempotencyKey, 512)) {
    errors.push('idempotencyKey is required or too long');
  }
  errors.push(...validateWellbeingObservationData(input.kind, input.data));
  errors.push(...validateTemporalReference(input.temporalReference));
  errors.push(...validateProvenanceHistory(input.provenanceHistory));
  errors.push(
    ...validateRevisionHistory(input.revisionHistory, input.kind, input.revision, input.updatedAt)
  );

  if (
    typeof input.revision !== 'number' ||
    !Number.isInteger(input.revision) ||
    input.revision < 1
  ) {
    errors.push('revision must be a positive integer');
  }
  if (!isValidDate(input.createdAt)) errors.push('createdAt must be a valid date');
  if (!isValidDate(input.updatedAt)) errors.push('updatedAt must be a valid date');
  if (
    isValidDate(input.createdAt) &&
    isValidDate(input.updatedAt) &&
    input.updatedAt < input.createdAt
  ) {
    errors.push('updatedAt cannot be before createdAt');
  }

  if (errors.length > 0) throw new Error(`Invalid wellbeing observation: ${errors.join('; ')}`);
}

export function asTemporalReference(value: unknown): TemporalReference {
  return value as TemporalReference;
}

export function asInitialProvenance(value: unknown): InitialWellbeingObservationProvenance {
  return value as InitialWellbeingObservationProvenance;
}

export function asProvenanceHistory(value: unknown): WellbeingObservationProvenanceHistory {
  return value as WellbeingObservationProvenanceHistory;
}
