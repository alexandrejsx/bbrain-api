import { InvalidWellbeingRecordError, TemporalReference } from './wellbeing.types';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function recordDateFromTemporalReference(value: TemporalReference): string {
  if (value.kind === 'specific_day' || value.kind === 'specific_night') {
    return assertDateKey(value.localDate);
  }
  if (value.kind === 'moment') {
    return formatDateInTimezone(new Date(value.at), value.timezone);
  }
  if (value.kind === 'interval') {
    const startsOn = formatDateInTimezone(new Date(value.startsAt), value.timezone);
    const endsOn = formatDateInTimezone(new Date(value.endsAt), value.timezone);
    if (startsOn === endsOn) return startsOn;
    throw new InvalidWellbeingRecordError();
  }
  if (
    value.kind === 'period' &&
    value.startsOn &&
    (!value.endsOn || value.endsOn === value.startsOn)
  ) {
    return assertDateKey(value.startsOn);
  }
  throw new InvalidWellbeingRecordError();
}

export function normalizeTemporalReference(value: unknown): TemporalReference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidWellbeingRecordError();
  }
  const candidate = value as Record<string, unknown>;
  const timezone = cleanString(candidate.timezone, 80) ?? 'UTC';
  if (candidate.kind === 'unknown') return { kind: 'unknown', timezone };
  const precision = candidate.precision === 'approximate' ? 'approximate' : 'exact';

  if (candidate.kind === 'specific_day' || candidate.kind === 'specific_night') {
    const localDate = cleanString(candidate.localDate, 10);
    if (!localDate) throw new InvalidWellbeingRecordError();
    assertDateKey(localDate);
    return { kind: candidate.kind, localDate, timezone, precision };
  }
  if (candidate.kind === 'moment') {
    const at = cleanIsoDate(candidate.at);
    if (!at) throw new InvalidWellbeingRecordError();
    return { kind: 'moment', at, timezone, precision };
  }
  if (candidate.kind === 'interval') {
    const startsAt = cleanIsoDate(candidate.startsAt);
    const endsAt = cleanIsoDate(candidate.endsAt);
    if (!startsAt || !endsAt || startsAt >= endsAt) throw new InvalidWellbeingRecordError();
    return { kind: 'interval', startsAt, endsAt, timezone, precision };
  }
  if (candidate.kind === 'period') {
    const startsOn = cleanString(candidate.startsOn, 10);
    const endsOn = cleanString(candidate.endsOn, 10);
    const descriptor = cleanString(candidate.descriptor, 120);
    if (
      (startsOn && !isDateKey(startsOn)) ||
      (endsOn && !isDateKey(endsOn)) ||
      (!startsOn && !endsOn && !descriptor)
    ) {
      throw new InvalidWellbeingRecordError();
    }
    return { kind: 'period', startsOn, endsOn, descriptor, timezone, precision };
  }
  throw new InvalidWellbeingRecordError();
}

export function mergePatch(
  current: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete result[key];
    else result[key] = value;
  }
  return result;
}

export function cleanString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.trim();
  return clean ? clean.slice(0, maxLength) : undefined;
}

export function cleanStringArray(value: unknown, limit: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(value.map((item) => cleanString(item, maxLength)).filter(Boolean) as string[])
  ].slice(0, limit);
}

export function finiteNumber(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : undefined;
}

export function validTime(value: unknown): string | undefined {
  const clean = cleanString(value, 5);
  return clean && timePattern.test(clean) ? clean : undefined;
}

function cleanIsoDate(value: unknown): string | undefined {
  const clean = cleanString(value, 40);
  if (!clean) return undefined;
  const parsed = new Date(clean);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
}

function assertDateKey(value: string): string {
  if (!isDateKey(value)) throw new InvalidWellbeingRecordError();
  return value;
}

function isDateKey(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function formatDateInTimezone(date: Date, timezone: string): string {
  if (!Number.isFinite(date.getTime())) throw new InvalidWellbeingRecordError();
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return assertDateKey(`${values.year}-${values.month}-${values.day}`);
  } catch (error) {
    if (error instanceof InvalidWellbeingRecordError) throw error;
    throw new InvalidWellbeingRecordError();
  }
}
