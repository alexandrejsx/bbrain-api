import { InvalidWellbeingRecordError } from '../../wellbeing/wellbeing.types';
import { MoodService } from '../mood.service';

describe('MoodService', () => {
  afterEach(() => jest.useRealTimers());

  it('creates an editable manual mood record aligned with the public contract', async () => {
    const created = { id: 'mood-1' };
    const repository = { create: jest.fn().mockResolvedValue(created) };
    const service = new MoodService(repository as never);

    await expect(
      service.createManual({
        userId: 'user-1',
        clientRequestId: 'request-1',
        kind: 'mood_event',
        data: { primaryEmotion: 'ansioso', secondaryEmotions: ['cansado'], intensity: 7 },
        temporalReference: {
          kind: 'specific_day',
          localDate: '2026-08-14',
          timezone: 'America/Sao_Paulo',
          precision: 'exact'
        }
      })
    ).resolves.toBe(created);

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'mood_event',
        data: expect.objectContaining({
          primaryEmotion: 'ansioso',
          secondaryEmotions: ['cansado'],
          intensity: 7
        }),
        revision: 1
      })
    );
  });

  it('preserves the selected mood level, instability qualifier and range midpoint', async () => {
    const repository = { create: jest.fn().mockResolvedValue({ id: 'mood-level-1' }) };
    const service = new MoodService(repository as never);

    await service.createManual({
      userId: 'user-1',
      clientRequestId: 'request-level-1',
      kind: 'mood_event',
      data: { moodLevel: 'low', isUnstable: true, note: 'Dia exigente.' },
      temporalReference: {
        kind: 'specific_day',
        localDate: '2026-08-14',
        timezone: 'America/Sao_Paulo',
        precision: 'exact'
      }
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recordDate: '2026-08-14',
        data: { isUnstable: true, moodLevel: 'low', moodScore: 3.5, note: 'Dia exigente.' }
      })
    );
  });

  it('counts canonical daily records consistently and keeps missing days explicit', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-22T12:00:00.000Z'));
    const records = [
      moodRecord('mood-1', '2026-08-20', { moodScore: 6 }),
      moodRecord('mood-2', '2026-08-22', { moodScore: 10 })
    ];
    const repository = {
      listInRange: jest.fn().mockResolvedValue(records),
      listPageInRange: jest.fn().mockResolvedValue({ items: records, totalItems: 2 })
    };
    const service = new MoodService(repository as never);

    const overview = await service.overview({
      userId: 'user-1',
      period: '7d',
      page: 1,
      pageSize: 9,
      timezone: 'UTC'
    });

    expect(overview.trend).toHaveLength(7);
    expect(overview.trend.find((bucket) => bucket.startsOn === '2026-08-20')).toEqual(
      expect.objectContaining({ level: 'middle', recordCount: 1 })
    );
    expect(overview.trend.filter((bucket) => bucket.level === null)).toHaveLength(5);
    expect(overview.summary).toEqual({ level: 'good', recordCount: 2 });
    expect(overview.history).toEqual(expect.objectContaining({ totalItems: 2, totalPages: 1 }));
    jest.useRealTimers();
  });

  it('counts a scoreless canonical record as a day with a record without inventing a level', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-22T12:00:00.000Z'));
    const records = [moodRecord('event-1', '2026-08-22', { descriptors: ['cansado'] })];
    const service = new MoodService({
      listInRange: jest.fn().mockResolvedValue(records),
      listPageInRange: jest.fn().mockResolvedValue({ items: records, totalItems: 1 })
    } as never);

    const overview = await service.overview({
      userId: 'user-1',
      period: '7d',
      page: 1,
      pageSize: 9,
      timezone: 'UTC'
    });

    expect(overview.summary).toEqual({ level: null, recordCount: 1 });
    expect(overview.trend.at(-1)).toEqual(expect.objectContaining({ level: null, recordCount: 1 }));
    jest.useRealTimers();
  });

  it('does not create an empty mood record', async () => {
    const service = new MoodService({ create: jest.fn() } as never);
    await expect(
      service.createManual({
        userId: 'user-1',
        clientRequestId: 'request-1',
        kind: 'mood_event',
        data: {},
        temporalReference: { kind: 'unknown', timezone: 'UTC' }
      })
    ).rejects.toBeInstanceOf(InvalidWellbeingRecordError);
  });

  it('creates a normalized guided check-in score without storing transcript text', async () => {
    const created = { id: 'mood-guided' };
    const repository = { create: jest.fn().mockResolvedValue(created) };
    const service = new MoodService(repository as never);
    await service.createFromGuidedCheckIn({
      userId: 'user-1',
      checkInId: 'check-in-1',
      sourceEventId: 'daily-check-in:check-in-1',
      capturedAt: new Date('2026-08-14T12:00:00Z'),
      timezone: 'UTC',
      localDate: '2026-08-14',
      score: 4,
      scoreConfidence: 0.94,
      note: 'Humor mais baixo associado a um conflito.',
      promptVersion: 'daily-check-in.v1'
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceEventId: 'daily-check-in:check-in-1',
        sessionId: 'check-in-1',
        data: { moodScore: 4, note: 'Humor mais baixo associado a um conflito.' },
        provenance: expect.objectContaining({ source: 'guided_checkin' })
      })
    );
    expect(repository.create.mock.calls[0][0]).not.toHaveProperty('userMessage');
  });

  it('edits a manual record through revision-aware persistence', async () => {
    const current = {
      kind: 'mood_event',
      data: { primaryEmotion: 'ansioso', intensity: 7 },
      recordDate: '2026-08-14',
      temporalReference: {
        kind: 'specific_day',
        localDate: '2026-08-14',
        timezone: 'UTC',
        precision: 'exact'
      }
    };
    const updated = { ...current, revision: 2 };
    const repository = {
      findById: jest.fn().mockResolvedValue(current),
      update: jest.fn().mockResolvedValue(updated)
    };
    const service = new MoodService(repository as never);

    await expect(
      service.correct({
        userId: 'user-1',
        id: 'mood-1',
        expectedRevision: 1,
        data: { intensity: 5 }
      })
    ).resolves.toBe(updated);
    expect(repository.update).toHaveBeenCalledWith(
      'user-1',
      'mood-1',
      1,
      '2026-08-14',
      expect.objectContaining({ primaryEmotion: 'ansioso', intensity: 5 }),
      current.temporalReference,
      expect.objectContaining({ source: 'manual_correction' })
    );
  });
});

function moodRecord(
  id: string,
  localDate: string,
  data: Record<string, unknown>,
  kind: 'mood_event' | 'mood_daily_summary' = 'mood_event'
) {
  const date = new Date(`${localDate}T12:00:00.000Z`);
  return {
    id,
    userId: 'user-1',
    recordDate: localDate,
    kind,
    data,
    temporalReference: {
      kind: 'specific_day' as const,
      localDate,
      timezone: 'UTC',
      precision: 'exact' as const
    },
    provenance: {
      source: 'guided_checkin' as const,
      checkInId: 'check-in-1',
      localDate,
      confidenceByField: {}
    },
    provenanceHistory: [],
    revision: 1,
    capturedAt: date,
    createdAt: date,
    updatedAt: date
  };
}
