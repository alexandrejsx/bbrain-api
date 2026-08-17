import { InvalidWellbeingRecordError } from '../../wellbeing/wellbeing.types';
import { SleepService } from '../sleep.service';

describe('SleepService', () => {
  it('preserves an approximate duration without inventing bedtime or wake time', async () => {
    const repository = { create: jest.fn().mockResolvedValue(true) };
    const service = new SleepService(repository as never);

    await service.createFromGuidedCheckIn({
      userId: 'user-1',
      checkInId: 'check-in-1',
      sourceEventId: 'event-1',
      capturedAt: new Date('2026-08-14T12:00:00Z'),
      timezone: 'America/Sao_Paulo',
      localDate: '2026-08-14',
      data: {
        durationMinutes: 360,
        durationConfidence: 0.95,
        durationApproximate: true,
        subjectiveQualityScore: null,
        subjectiveQualityConfidence: null,
        awakeningsCount: null,
        awakeningsConfidence: null,
        awakeningsApproximate: false,
        multipleAwakenings: false,
        awakeDuringNightMinutes: null,
        awakeDuringNightConfidence: null,
        awakeDuringNightApproximate: false,
        restfulnessScore: 8,
        restfulnessConfidence: 0.9,
        note: null
      },
      promptVersion: 'daily-check-in.v1'
    });

    const persisted = repository.create.mock.calls[0][0];
    expect(persisted.data).toEqual({
      durationMinutes: { value: 360, precision: 'approximate' },
      restfulnessScore: 8
    });
    expect(persisted.temporalReference).toEqual({
      kind: 'specific_night',
      localDate: '2026-08-14',
      timezone: 'America/Sao_Paulo',
      precision: 'exact'
    });
    expect(persisted.data).not.toHaveProperty('bedtime');
    expect(persisted.data).not.toHaveProperty('wakeTime');
  });

  it('preserves multiple independent sleep dimensions', async () => {
    const repository = { create: jest.fn().mockResolvedValue(true) };
    const service = new SleepService(repository as never);
    await service.createFromGuidedCheckIn({
      userId: 'user-1',
      checkInId: 'check-in-2',
      sourceEventId: 'event-2',
      capturedAt: new Date('2026-08-14T12:00:00Z'),
      timezone: 'UTC',
      localDate: '2026-08-14',
      data: {
        durationMinutes: 420,
        durationConfidence: 0.98,
        durationApproximate: false,
        subjectiveQualityScore: 7,
        subjectiveQualityConfidence: 0.9,
        awakeningsCount: 3,
        awakeningsConfidence: 0.98,
        awakeningsApproximate: false,
        multipleAwakenings: true,
        awakeDuringNightMinutes: 20,
        awakeDuringNightConfidence: 0.93,
        awakeDuringNightApproximate: true,
        restfulnessScore: null,
        restfulnessConfidence: null,
        note: null
      },
      promptVersion: 'daily-check-in.v1'
    });

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.create.mock.calls[0][0].data).toEqual({
      durationMinutes: { value: 420, precision: 'exact' },
      subjectiveQualityScore: 7,
      awakeningCount: { value: 3, precision: 'exact' },
      multipleAwakenings: true,
      awakeDuringNightMinutes: { value: 20, precision: 'approximate' }
    });
  });

  it('does not create an empty manual sleep record', async () => {
    const service = new SleepService({ create: jest.fn() } as never);
    await expect(
      service.createManual({
        userId: 'user-1',
        clientRequestId: 'request-1',
        data: {},
        temporalReference: { kind: 'unknown', timezone: 'UTC' }
      })
    ).rejects.toBeInstanceOf(InvalidWellbeingRecordError);
  });

  it('edits only the supplied sleep fields and preserves the remaining observation', async () => {
    const current = {
      data: {
        durationMinutes: { value: 360, precision: 'approximate' },
        quality: { value: 'ruim', precision: 'exact' }
      },
      temporalReference: { kind: 'unknown', timezone: 'UTC' }
    };
    const updated = { ...current, revision: 2 };
    const repository = {
      findById: jest.fn().mockResolvedValue(current),
      update: jest.fn().mockResolvedValue(updated)
    };
    const service = new SleepService(repository as never);

    await expect(
      service.correct({
        userId: 'user-1',
        id: 'sleep-1',
        expectedRevision: 1,
        data: { quality: { value: 'boa', precision: 'exact' } }
      })
    ).resolves.toBe(updated);
    expect(repository.update).toHaveBeenCalledWith(
      'user-1',
      'sleep-1',
      1,
      {
        durationMinutes: { value: 360, precision: 'approximate' },
        quality: { value: 'boa', precision: 'exact' }
      },
      current.temporalReference,
      expect.objectContaining({ source: 'manual_correction' })
    );
  });
});
