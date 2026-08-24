import { MoodService } from '../../modules/mood/mood.service';
import { SleepService } from '../../modules/sleep/sleep.service';
import { buildMoodSeed, MOOD_SEED_PREFIX, runMoodSeed } from '../mood.seed';
import { buildSleepSeed, runSleepSeed, SLEEP_SEED_PREFIX } from '../sleep.seed';

const REFERENCE_AT = new Date('2026-08-22T15:00:00.000Z');
const TIMEZONE = 'America/Sao_Paulo';

describe('wellbeing seeds', () => {
  it('builds 30 consecutive unique mood days with realistic variation', () => {
    const records = buildMoodSeed(REFERENCE_AT, TIMEZONE);
    expect(records).toHaveLength(30);
    expect(new Set(records.map((item) => item.recordDate)).size).toBe(30);
    expect(records[0].recordDate).toBe('2026-07-24');
    expect(records.at(-1)?.recordDate).toBe('2026-08-22');
    expect(new Set(records.map((item) => item.data.moodLevel)).size).toBe(5);
    expect(records.filter((item) => item.data.isUnstable)).toHaveLength(6);
  });

  it('builds recent and monthly sleep records with plausible variation', () => {
    const records = buildSleepSeed(REFERENCE_AT, TIMEZONE);
    const durations = records.map((item) => (item.data.durationMinutes as { value: number }).value);
    expect(records).toHaveLength(40);
    expect(new Set(records.map((item) => item.recordDate)).size).toBe(40);
    expect(records[0].recordDate).toBe('2025-09-08');
    expect(records.at(-1)?.recordDate).toBe('2026-08-22');
    expect(Math.min(...durations)).toBeLessThan(300);
    expect(Math.max(...durations)).toBeGreaterThanOrEqual(600);
    expect(new Set(durations).size).toBeGreaterThan(10);
    expect(new Set(records.map((item) => item.data.wakeRestfulness)).size).toBe(4);
    expect(new Set(records.map((item) => item.data.awakeTimeDuringNight)).size).toBe(4);
    expect(records.some((item) => !item.data.sleepLatency)).toBe(true);
    expect(records.some((item) => !item.data.sleepOnsetTime)).toBe(true);
    expect(records.some((item) => !item.data.wakeTime)).toBe(true);
    expect(records.some((item) => item.data.note)).toBe(true);
  });

  it('reexecutes mood and sleep seeds without accumulating duplicates', async () => {
    const moodStore = seedStore(MOOD_SEED_PREFIX);
    const sleepStore = seedStore(SLEEP_SEED_PREFIX);
    const moodService = new MoodService({ create: moodStore.create } as never);
    const sleepService = new SleepService({ create: sleepStore.create } as never);

    for (let run = 0; run < 2; run += 1) {
      await runMoodSeed({
        userId: 'user-1',
        timezone: TIMEZONE,
        referenceAt: REFERENCE_AT,
        service: moodService,
        repository: { deleteSeedRecords: moodStore.deleteSeedRecords }
      });
      await runSleepSeed({
        userId: 'user-1',
        timezone: TIMEZONE,
        referenceAt: REFERENCE_AT,
        service: sleepService,
        repository: {
          deleteSeedRecords: sleepStore.deleteSeedRecords,
          deleteByUserId: sleepStore.deleteByUserId
        }
      });
    }

    expect(moodStore.records.size).toBe(30);
    expect(sleepStore.records.size).toBe(40);
  });
});

function seedStore(prefix: string) {
  const records = new Map<string, unknown>();
  return {
    records,
    create: jest.fn((input: { clientRequestId?: string; recordDate: string }) => {
      if (!input.clientRequestId?.startsWith(prefix)) throw new Error('Unexpected seed request');
      if (records.has(input.recordDate)) throw new Error('Duplicate daily seed record');
      records.set(input.recordDate, input);
      return Promise.resolve(input);
    }),
    deleteSeedRecords: jest.fn(() => {
      const deleted = records.size;
      records.clear();
      return Promise.resolve(deleted);
    }),
    deleteByUserId: jest.fn(() => {
      const deleted = records.size;
      records.clear();
      return Promise.resolve(deleted);
    })
  };
}
