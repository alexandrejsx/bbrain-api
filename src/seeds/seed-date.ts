import { InvalidWellbeingRecordError } from '../modules/wellbeing/wellbeing.types';

export function localDateAt(referenceAt: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(referenceAt);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    throw new InvalidWellbeingRecordError();
  }
}

export function consecutiveDateKeys(endsOn: string, count: number): string[] {
  const end = new Date(`${endsOn}T12:00:00.000Z`);
  if (!Number.isInteger(count) || count < 1 || Number.isNaN(end.getTime())) {
    throw new Error('Invalid seed date range');
  }
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(date.getUTCDate() - (count - 1 - index));
    return date.toISOString().slice(0, 10);
  });
}
