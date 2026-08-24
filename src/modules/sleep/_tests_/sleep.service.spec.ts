import { randomUUID } from 'node:crypto';
import { InvalidWellbeingRecordError } from '../../wellbeing/wellbeing.types';
import { SleepService } from '../sleep.service';

const essentialData = {
  durationMinutes: { value: 450, precision: 'exact' },
  wakeRestfulness: 'fairly_rested',
  awakeTimeDuringNight: '15_to_29'
} as const;

const temporalReference = {
  kind: 'specific_night' as const,
  localDate: '2026-08-14',
  timezone: 'America/Sao_Paulo',
  precision: 'exact' as const
};

describe('SleepService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-22T15:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('requires all three quality inputs and rejects invalid values', async () => {
    const service = new SleepService({ create: jest.fn() } as never);
    for (const data of [
      {},
      { ...essentialData, durationMinutes: { value: 0, precision: 'exact' } },
      { ...essentialData, wakeRestfulness: 'unknown' },
      { ...essentialData, awakeTimeDuringNight: 'sometimes' }
    ]) {
      await expect(
        service.createManual({
          userId: 'user-1',
          clientRequestId: randomUUID(),
          data,
          temporalReference
        })
      ).rejects.toBeInstanceOf(InvalidWellbeingRecordError);
    }
  });

  it.each([
    { ...essentialData, sleepLatency: 'eventually' },
    { ...essentialData, sleepOnsetTime: { value: '25:00', precision: 'exact' } },
    { ...essentialData, wakeTime: { value: '07:00', precision: 'uncertain' } },
    { ...essentialData, durationMinutes: { value: 450, precision: 'uncertain' } }
  ])('rejects an invalid optional enum, time, or precision', async (data) => {
    const service = new SleepService({ create: jest.fn() } as never);
    await expect(
      service.createManual({
        userId: 'user-1',
        clientRequestId: randomUUID(),
        data,
        temporalReference
      })
    ).rejects.toBeInstanceOf(InvalidWellbeingRecordError);
  });

  it('calculates quality on the backend and ignores a client supplied result', async () => {
    const repository = { create: jest.fn((input) => Promise.resolve(input)) };
    const service = new SleepService(repository as never);
    await service.createManual({
      userId: 'user-1',
      clientRequestId: 'request-1',
      temporalReference,
      data: {
        ...essentialData,
        sleepQuality: { score: 0, rawScore: 0, classification: 'very_bad' },
        sleepLatency: '16_to_30',
        sleepOnsetTime: { value: '23:10', precision: 'approximate' },
        wakeTime: { value: '06:40', precision: 'exact' },
        note: 'Acordei com barulho.'
      }
    });

    expect(repository.create.mock.calls[0][0].data).toEqual({
      ...essentialData,
      sleepQuality: {
        score: 8,
        rawScore: 25 / 3,
        classification: 'good',
        components: { duration: 10, wakeRestfulness: 7, awakeTimeDuringNight: 8 },
        algorithmVersion: 'bbrain-sleep-quality-v1'
      },
      sleepLatency: '16_to_30',
      sleepOnsetTime: { value: '23:10', precision: 'approximate' },
      wakeTime: { value: '06:40', precision: 'exact' },
      note: 'Acordei com barulho.'
    });
  });

  it('creates guided structured sleep with exact provenance', async () => {
    const repository = { create: jest.fn((input) => Promise.resolve(input)) };
    await new SleepService(repository as never).createFromGuidedCheckIn({
      userId: 'user-1',
      checkInId: 'check-in-1',
      sourceEventId: 'event-1',
      capturedAt: new Date('2026-08-14T12:00:00Z'),
      timezone: 'America/Sao_Paulo',
      localDate: '2026-08-13',
      data: {
        durationMinutes: 450,
        wakeRestfulness: 'fairly_rested',
        awakeTimeDuringNight: '15_to_29',
        note: 'Noite com chuva.'
      },
      promptVersion: 'daily-check-in.v5'
    });
    expect(repository.create.mock.calls[0][0]).toMatchObject({
      recordDate: '2026-08-13',
      data: { ...essentialData, note: 'Noite com chuva.' },
      temporalReference: { kind: 'specific_night', localDate: '2026-08-13' },
      provenance: {
        source: 'guided_checkin',
        confidenceByField: { durationMinutes: 1, wakeRestfulness: 1, awakeTimeDuringNight: 1 }
      }
    });
  });

  it('recalculates quality after a correction', async () => {
    const current = { data: essentialData, recordDate: '2026-08-14', temporalReference };
    const repository = {
      findById: jest.fn().mockResolvedValue(current),
      update: jest.fn((...args) => Promise.resolve(args[4]))
    };
    await new SleepService(repository as never).correct({
      userId: 'user-1',
      id: 'sleep-1',
      expectedRevision: 1,
      data: { durationMinutes: { value: 300, precision: 'exact' } }
    });
    expect(repository.update.mock.calls[0][4]).toMatchObject({
      durationMinutes: { value: 300, precision: 'exact' },
      sleepQuality: { score: 7, rawScore: 20 / 3, classification: 'good' }
    });
  });

  it('uses raw quality and starts an annual trend at the first real month', async () => {
    const records = [
      { recordDate: '2026-05-10', data: { ...essentialData, sleepQuality: { rawScore: 25 / 3 } } },
      {
        recordDate: '2026-08-10',
        data: {
          ...essentialData,
          durationMinutes: { value: 390 },
          sleepQuality: { rawScore: 20 / 3 }
        }
      }
    ];
    const repository = {
      listInRange: jest.fn().mockResolvedValue(records),
      listPageInRange: jest.fn().mockResolvedValue({ items: records, totalItems: 2 })
    };
    const overview = await new SleepService(repository as never).overview({
      userId: 'user-1',
      period: '1y',
      page: 1,
      pageSize: 9,
      timezone: 'America/Sao_Paulo'
    });
    expect(overview.trend[0].startsOn).toBe('2026-05-01');
    expect(overview.trend).toHaveLength(4);
    expect(overview.summary.averageQualityScore).toBeCloseTo(7.5);
    expect(overview.summary.averageDurationMinutes).toBe(420);
  });

  it('returns no artificial annual buckets without records', async () => {
    const repository = {
      listInRange: jest.fn().mockResolvedValue([]),
      listPageInRange: jest.fn().mockResolvedValue({ items: [], totalItems: 0 })
    };
    const overview = await new SleepService(repository as never).overview({
      userId: 'user-1',
      period: '1y',
      page: 1,
      pageSize: 9,
      timezone: 'UTC'
    });
    expect(overview.trend).toEqual([]);
  });

  it.each([
    ['7d', 7],
    ['30d', 5]
  ] as const)(
    'keeps %s responsive buckets without inventing values',
    async (period, bucketCount) => {
      const records = [
        {
          recordDate: '2026-08-22',
          data: { ...essentialData, sleepQuality: { rawScore: 25 / 3 } }
        }
      ];
      const repository = {
        listInRange: jest.fn().mockResolvedValue(records),
        listPageInRange: jest.fn().mockResolvedValue({ items: records, totalItems: 1 })
      };
      const overview = await new SleepService(repository as never).overview({
        userId: 'user-1',
        period,
        page: 1,
        pageSize: 9,
        timezone: 'America/Sao_Paulo'
      });
      expect(overview.trend).toHaveLength(bucketCount);
      expect(overview.trend.filter((bucket) => bucket.averageQualityScore !== null)).toHaveLength(
        1
      );
      expect(overview.summary.recordCount).toBe(1);
    }
  );
});
