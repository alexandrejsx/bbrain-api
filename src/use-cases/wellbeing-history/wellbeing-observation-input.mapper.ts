import {
  MoodDailySummaryData,
  MoodEventData,
  SleepRecordData,
  TemporalReference
} from '../../domain/wellbeing-history/value-objects/wellbeing-observation.types';
import {
  MoodObservationData,
  ObservationCandidate,
  ObservationTemporalReference,
  SleepObservationData
} from './ports/observation-extractor.port';
import { parseStrictOffsetDateTime } from './strict-iso-datetime';

const MOOD_REMOVAL_MAP = {
  emotions: 'descriptors',
  isMixed: 'isMixed',
  intensity: 'explicitIntensity',
  score: 'explicitRating'
} as const;

const SLEEP_REMOVAL_MAP = {
  durationMinutes: 'durationMinutes',
  fellAsleepAt: 'bedtime',
  wokeAt: 'wakeTime',
  awakenings: 'awakeningCount',
  quality: 'quality',
  restedness: 'wakeFeeling'
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function normalizeTimezone(value: unknown, fallback = 'UTC'): string {
  const candidate = typeof value === 'string' && value.trim() ? value.trim() : fallback;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return fallback;
  }
}

function parseOffsetDate(value: unknown, path: string): Date {
  const parsed = parseStrictOffsetDateTime(value);
  if (!parsed) {
    throw new Error(`${path} must be an ISO-8601 datetime with an explicit offset`);
  }
  return parsed;
}

function parseManualTimezone(value: unknown, fallbackTimezone: string): string {
  if (value === undefined) return normalizeTimezone(fallbackTimezone);
  if (typeof value !== 'string' || !value.trim()) throw new Error('timezone is invalid');

  const normalized = normalizeTimezone(value, '__invalid_timezone__');
  if (normalized === '__invalid_timezone__') throw new Error('timezone is invalid');
  return normalized;
}

function parseManualPrecision(value: unknown): 'exact' | 'approximate' {
  if (value === undefined) return 'exact';
  if (value !== 'exact' && value !== 'approximate') throw new Error('precision is invalid');
  return value;
}

function assertManualTemporalKeys(
  value: Record<string, unknown>,
  allowed: readonly string[]
): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error('Temporal reference contains an unexpected field');
  }
}

function toLocalDate(date: Date, timezone: string): string | undefined {
  if (Number.isNaN(date.getTime())) return undefined;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return values.year && values.month && values.day
    ? `${values.year}-${values.month}-${values.day}`
    : undefined;
}

function toLocalTime(value: string | undefined, timezone: string): string | undefined {
  if (!value || !value.includes('T')) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.hour && values.minute ? `${values.hour}:${values.minute}` : undefined;
}

export function parseManualTemporalReference(
  value: unknown,
  fallbackTimezone: string
): TemporalReference {
  if (!isRecord(value)) throw new Error('A temporal reference is required');

  const timezone = parseManualTimezone(value.timezone, fallbackTimezone);

  switch (value.kind) {
    case 'moment': {
      assertManualTemporalKeys(value, ['kind', 'timezone', 'precision', 'at']);
      return {
        kind: 'moment',
        timezone,
        precision: parseManualPrecision(value.precision),
        at: parseOffsetDate(value.at, 'temporalReference.at')
      };
    }
    case 'specific_day':
      assertManualTemporalKeys(value, ['kind', 'timezone', 'precision', 'localDate']);
      return {
        kind: 'specific_day',
        timezone,
        precision: parseManualPrecision(value.precision),
        localDate: typeof value.localDate === 'string' ? value.localDate : ''
      };
    case 'specific_night':
      assertManualTemporalKeys(value, ['kind', 'timezone', 'precision', 'localDate']);
      return {
        kind: 'specific_night',
        timezone,
        precision: parseManualPrecision(value.precision),
        localDate: typeof value.localDate === 'string' ? value.localDate : ''
      };
    case 'interval':
      assertManualTemporalKeys(value, ['kind', 'timezone', 'precision', 'startsAt', 'endsAt']);
      return {
        kind: 'interval',
        timezone,
        precision: parseManualPrecision(value.precision),
        startsAt: parseOffsetDate(value.startsAt, 'temporalReference.startsAt'),
        endsAt: parseOffsetDate(value.endsAt, 'temporalReference.endsAt')
      };
    case 'period':
      assertManualTemporalKeys(value, [
        'kind',
        'timezone',
        'precision',
        'startsOn',
        'endsOn',
        'descriptor'
      ]);
      return {
        kind: 'period',
        timezone,
        precision: parseManualPrecision(value.precision),
        ...(typeof value.startsOn === 'string' ? { startsOn: value.startsOn } : {}),
        ...(typeof value.endsOn === 'string' ? { endsOn: value.endsOn } : {}),
        ...(typeof value.descriptor === 'string' ? { descriptor: value.descriptor } : {})
      };
    case 'unknown':
      assertManualTemporalKeys(value, ['kind', 'timezone']);
      return { kind: 'unknown', timezone };
    default:
      throw new Error('Invalid temporal reference kind');
  }
}

function localDateFromValue(value: string | undefined, timezone: string): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return toLocalDate(new Date(value), timezone);
}

function mapExtractionTemporal(
  temporal: ObservationTemporalReference,
  timezone: string,
  periodDescription?: string
): TemporalReference {
  const precision = temporal.precision === 'exact' ? 'exact' : 'approximate';
  const start = temporal.startAt ? new Date(temporal.startAt) : undefined;
  const end = temporal.endAt ? new Date(temporal.endAt) : undefined;

  switch (temporal.scope) {
    case 'moment':
      return start && !Number.isNaN(start.getTime())
        ? { kind: 'moment', timezone, precision, at: start }
        : { kind: 'unknown', timezone };
    case 'day': {
      const localDate = localDateFromValue(temporal.startAt, timezone);
      return localDate
        ? { kind: 'specific_day', timezone, precision, localDate }
        : { kind: 'unknown', timezone };
    }
    case 'night': {
      const localDate = localDateFromValue(temporal.startAt, timezone);
      return localDate
        ? { kind: 'specific_night', timezone, precision, localDate }
        : { kind: 'unknown', timezone };
    }
    case 'interval':
      return start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())
        ? { kind: 'interval', timezone, precision, startsAt: start, endsAt: end }
        : { kind: 'unknown', timezone };
    case 'ongoing_period': {
      const startsOn = localDateFromValue(temporal.startAt, timezone);
      const endsOn = localDateFromValue(temporal.endAt, timezone);
      const descriptor = temporal.originalExpression ?? periodDescription;

      return startsOn || endsOn || descriptor
        ? {
            kind: 'period',
            timezone,
            precision,
            ...(startsOn ? { startsOn } : {}),
            ...(endsOn ? { endsOn } : {}),
            ...(descriptor ? { descriptor } : {})
          }
        : { kind: 'unknown', timezone };
    }
    default:
      return { kind: 'unknown', timezone };
  }
}

function mapMoodBase(mood: MoodObservationData): MoodEventData {
  const descriptors = [...(mood.emotions ?? [])];

  return {
    ...(descriptors.length ? { descriptors } : {}),
    ...(mood.isMixed === true ? { isMixed: true } : {}),
    ...(mood.score !== undefined && mood.scoreScaleMax !== undefined
      ? { explicitRating: { value: mood.score, scaleMax: mood.scoreScaleMax } }
      : {}),
    ...(mood.intensity !== undefined && mood.intensityScaleMax !== undefined
      ? { explicitIntensity: { value: mood.intensity, scaleMax: mood.intensityScaleMax } }
      : {})
  };
}

function mapMoodSummary(mood: MoodObservationData): MoodDailySummaryData {
  const coverage =
    mood.coverage === 'full_day'
      ? 'sufficient'
      : mood.coverage === 'single_moment' || mood.coverage === 'partial_day'
        ? 'partial'
        : 'unknown';

  return {
    ...mapMoodBase(mood),
    sourceObservationIds: [],
    coverage,
    status: 'current',
    summarySource: 'user_explicit'
  };
}

function mapSleep(sleep: SleepObservationData, timezone: string): SleepRecordData {
  const bedtime = toLocalTime(sleep.fellAsleepAt, timezone);
  const wakeTime = toLocalTime(sleep.wokeAt, timezone);

  return {
    ...(sleep.durationMinutes === undefined
      ? {}
      : {
          durationMinutes: {
            value: sleep.durationMinutes,
            precision: sleep.durationIsApproximate ? ('approximate' as const) : ('exact' as const)
          }
        }),
    ...(sleep.quality
      ? {
          quality: {
            value: sleep.quality,
            precision: sleep.qualityIsApproximate ? ('approximate' as const) : ('exact' as const)
          }
        }
      : {}),
    ...(bedtime
      ? {
          bedtime: {
            value: bedtime,
            precision: sleep.fellAsleepAtIsApproximate
              ? ('approximate' as const)
              : ('exact' as const)
          }
        }
      : {}),
    ...(wakeTime
      ? {
          wakeTime: {
            value: wakeTime,
            precision: sleep.wokeAtIsApproximate ? ('approximate' as const) : ('exact' as const)
          }
        }
      : {}),
    ...(sleep.awakenings === undefined
      ? {}
      : {
          awakeningCount: {
            value: sleep.awakenings,
            precision: sleep.awakeningsIsApproximate ? ('approximate' as const) : ('exact' as const)
          }
        }),
    ...(sleep.restedness
      ? {
          wakeFeeling: {
            value: sleep.restedness,
            precision: sleep.restednessIsApproximate ? ('approximate' as const) : ('exact' as const)
          }
        }
      : {})
  };
}

export function toDomainCandidate(candidate: ObservationCandidate, timezoneInput: string) {
  const timezone = normalizeTimezone(timezoneInput);
  const subject = candidate.subject === 'user' ? 'self' : candidate.subject;
  const assertion =
    candidate.assertion === 'future_intent'
      ? 'desired'
      : candidate.assertion === 'uncertain'
        ? 'unknown'
        : candidate.assertion === 'conditional' || candidate.assertion === 'fictional'
          ? 'hypothetical'
          : candidate.assertion;
  const reportingMode =
    candidate.subject === 'third_party' || candidate.evidenceMode === 'third_party_report'
      ? 'third_party_report'
      : 'direct_self_report';
  const data =
    candidate.kind === 'sleep_record'
      ? mapSleep(candidate.sleep, timezone)
      : candidate.kind === 'mood_daily_summary'
        ? mapMoodSummary(candidate.mood)
        : mapMoodBase(candidate.mood);
  const removeFields = (candidate.removeFields ?? []).map((field) =>
    candidate.kind === 'sleep_record'
      ? SLEEP_REMOVAL_MAP[field as keyof typeof SLEEP_REMOVAL_MAP]
      : MOOD_REMOVAL_MAP[field as keyof typeof MOOD_REMOVAL_MAP]
  );

  return {
    subject,
    assertion,
    reportingMode,
    confidence: candidate.confidence,
    evidenceQuote: candidate.sourceQuote,
    ...(candidate.correctsObservationId
      ? { correctsObservationId: candidate.correctsObservationId }
      : {}),
    ...(removeFields.length ? { removeFields } : {}),
    kind: candidate.kind,
    data,
    temporalReference: mapExtractionTemporal(
      candidate.temporal,
      timezone,
      candidate.kind === 'sleep_record' ? candidate.sleep.periodDescription : undefined
    )
  };
}
