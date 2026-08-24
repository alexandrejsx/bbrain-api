import { MoodService } from '../modules/mood/mood.service';
import { MoodRepository } from '../modules/mood/mood.repository';
import { MoodLevel } from '../modules/mood/mood-level';
import { consecutiveDateKeys, localDateAt } from './seed-date';

export const MOOD_SEED_PREFIX = 'seed:mood:';

const LEVELS: readonly MoodLevel[] = [
  'middle',
  'good',
  'good',
  'middle',
  'low',
  'low',
  'middle',
  'good',
  'very_good',
  'good',
  'good',
  'middle',
  'low',
  'very_low',
  'low',
  'middle',
  'middle',
  'good',
  'very_good',
  'very_good',
  'good',
  'middle',
  'good',
  'low',
  'middle',
  'good',
  'good',
  'very_good',
  'good',
  'middle'
];

const UNSTABLE_DAYS = new Set([3, 8, 12, 17, 23, 28]);
const NOTES: Readonly<Record<number, string>> = {
  1: 'Dia leve e produtivo.',
  5: 'A rotina ficou mais puxada.',
  8: 'Muita coisa mudou ao longo do dia.',
  13: 'Pouca energia para as tarefas.',
  18: 'Consegui descansar e desacelerar.',
  23: 'O dia alternou entre calma e tensão.',
  27: 'Um encontro bom trouxe ânimo.'
};

export type MoodSeedRecord = {
  recordDate: string;
  data: { moodLevel: MoodLevel; isUnstable?: true; note?: string };
};

export function buildMoodSeed(referenceAt: Date, timezone: string): MoodSeedRecord[] {
  return consecutiveDateKeys(localDateAt(referenceAt, timezone), LEVELS.length).map(
    (recordDate, index) => ({
      recordDate,
      data: {
        moodLevel: LEVELS[index],
        ...(UNSTABLE_DAYS.has(index) ? { isUnstable: true as const } : {}),
        ...(NOTES[index] ? { note: NOTES[index] } : {})
      }
    })
  );
}

export async function runMoodSeed(input: {
  userId: string;
  timezone: string;
  referenceAt: Date;
  service: Pick<MoodService, 'createManual'>;
  repository: Pick<MoodRepository, 'deleteSeedRecords'>;
}) {
  const records = buildMoodSeed(input.referenceAt, input.timezone);
  const deleted = await input.repository.deleteSeedRecords(input.userId, MOOD_SEED_PREFIX);
  for (const record of records) {
    await input.service.createManual({
      userId: input.userId,
      clientRequestId: `${MOOD_SEED_PREFIX}${record.recordDate}`,
      kind: 'mood_event',
      data: record.data,
      temporalReference: {
        kind: 'specific_day',
        localDate: record.recordDate,
        timezone: input.timezone,
        precision: 'exact'
      }
    });
  }
  return { deleted, created: records.length, recordDates: records.map((item) => item.recordDate) };
}
