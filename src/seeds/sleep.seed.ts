import { SleepRepository } from '../modules/sleep/sleep.repository';
import { SleepService } from '../modules/sleep/sleep.service';
import {
  AwakeTimeDuringNight,
  SleepLatency,
  WakeRestfulness
} from '../modules/sleep/sleep-quality';
import { consecutiveDateKeys, localDateAt } from './seed-date';

export const SLEEP_SEED_PREFIX = 'seed:sleep:';

const DURATIONS = [
  455, 430, 385, 470, 335, 445, 510, 400, 365, 485, 295, 425, 540, 390, 460, 350, 440, 575, 410,
  455, 315, 480, 430, 600, 370, 445, 500, 405, 460, 280
] as const;
const RESTFULNESS: WakeRestfulness[] = [
  'rested',
  'fairly_rested',
  'tired',
  'rested',
  'very_tired',
  'fairly_rested',
  'rested',
  'tired',
  'fairly_rested',
  'rested',
  'tired',
  'fairly_rested',
  'rested',
  'tired',
  'rested',
  'very_tired',
  'fairly_rested',
  'rested',
  'tired',
  'fairly_rested',
  'very_tired',
  'rested',
  'fairly_rested',
  'tired',
  'tired',
  'rested',
  'fairly_rested',
  'tired',
  'rested',
  'very_tired'
];
const AWAKE_TIME: AwakeTimeDuringNight[] = [
  'under_15',
  '15_to_29',
  '30_to_59',
  'under_15',
  '60_or_more',
  '15_to_29',
  'under_15',
  '30_to_59',
  '15_to_29',
  'under_15',
  '60_or_more',
  '15_to_29',
  'under_15',
  '30_to_59',
  'under_15',
  '60_or_more',
  '15_to_29',
  'under_15',
  '30_to_59',
  '15_to_29',
  '60_or_more',
  'under_15',
  '15_to_29',
  '30_to_59',
  '30_to_59',
  'under_15',
  '15_to_29',
  '30_to_59',
  'under_15',
  '60_or_more'
];
const NOTES: Readonly<Record<number, string>> = {
  4: 'Barulho na rua durante a madrugada.',
  9: 'Noite tranquila depois de um dia corrido.',
  15: 'Demorei para relaxar.',
  21: 'Acordei antes do despertador.',
  27: 'Quarto mais quente que o habitual.'
};

export type SleepSeedRecord = { recordDate: string; data: Record<string, unknown> };

export function buildSleepSeed(referenceAt: Date, timezone: string): SleepSeedRecord[] {
  const today = localDateAt(referenceAt, timezone);
  const recent = consecutiveDateKeys(today, DURATIONS.length);
  const historical = historicalMonthDates(today, 10);
  return [...historical, ...recent].map((recordDate, index) => {
    const sourceIndex = index % DURATIONS.length;
    const latency: SleepLatency =
      sourceIndex % 11 === 0
        ? 'over_60'
        : sourceIndex % 7 === 0
          ? '31_to_60'
          : sourceIndex % 3 === 0
            ? '16_to_30'
            : 'up_to_15';
    return {
      recordDate,
      data: {
        durationMinutes: {
          value: DURATIONS[sourceIndex],
          precision: sourceIndex % 9 === 0 ? 'approximate' : 'exact'
        },
        wakeRestfulness: RESTFULNESS[sourceIndex],
        awakeTimeDuringNight: AWAKE_TIME[sourceIndex],
        ...(sourceIndex % 4 !== 2 ? { sleepLatency: latency } : {}),
        ...(sourceIndex % 3 !== 1
          ? {
              sleepOnsetTime: {
                value: sourceIndex % 5 === 0 ? '23:35' : '22:50',
                precision: sourceIndex % 6 === 0 ? 'approximate' : 'exact'
              }
            }
          : {}),
        ...(sourceIndex % 4 !== 1
          ? {
              wakeTime: {
                value: sourceIndex % 5 === 0 ? '06:20' : '06:45',
                precision: sourceIndex % 8 === 0 ? 'approximate' : 'exact'
              }
            }
          : {}),
        ...(NOTES[sourceIndex] ? { note: NOTES[sourceIndex] } : {})
      }
    };
  });
}

export async function runSleepSeed(input: {
  userId: string;
  timezone: string;
  referenceAt: Date;
  replaceAll?: boolean;
  service: Pick<SleepService, 'createManual'>;
  repository: Pick<SleepRepository, 'deleteSeedRecords' | 'deleteByUserId'>;
}) {
  const records = buildSleepSeed(input.referenceAt, input.timezone);
  const deleted = input.replaceAll
    ? await input.repository.deleteByUserId(input.userId)
    : await input.repository.deleteSeedRecords(input.userId, SLEEP_SEED_PREFIX);
  for (const record of records) {
    await input.service.createManual({
      userId: input.userId,
      clientRequestId: `${SLEEP_SEED_PREFIX}${record.recordDate}`,
      data: record.data,
      temporalReference: {
        kind: 'specific_night',
        localDate: record.recordDate,
        timezone: input.timezone,
        precision: 'exact'
      }
    });
  }
  return { deleted, created: records.length, recordDates: records.map((item) => item.recordDate) };
}

function historicalMonthDates(today: string, count: number): string[] {
  const reference = new Date(`${today}T12:00:00.000Z`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(
      Date.UTC(
        reference.getUTCFullYear(),
        reference.getUTCMonth() - (count - index + 1),
        index % 2 === 0 ? 8 : 17,
        12
      )
    );
    return date.toISOString().slice(0, 10);
  });
}
