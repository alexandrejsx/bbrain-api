import { InvalidWellbeingRecordError } from '../wellbeing/wellbeing.types';
import { SleepService } from './sleep.service';

describe('SleepService', () => {
  it('preserves an approximate duration without inventing bedtime or wake time', async () => {
    const repository = { create: jest.fn().mockResolvedValue(true) };
    const service = new SleepService(repository as never);

    await service.createFromChat({
      userId: 'user-1',
      sessionId: 'session-1',
      sourceEventId: 'event-1',
      capturedAt: new Date('2026-08-14T12:00:00Z'),
      timezone: 'America/Sao_Paulo',
      confidence: 0.95,
      data: {
        durationMinutes: 360,
        durationMinMinutes: null,
        durationMaxMinutes: null,
        bedtime: null,
        wakeTime: null,
        quality: null,
        awakenings: null,
        wakeFeeling: null,
        date: null,
        period: null,
        precision: 'approximate'
      },
      extractorVersion: 'extractor.v1',
      promptVersion: 'sleep.v1'
    });

    const persisted = repository.create.mock.calls[0][0];
    expect(persisted.data).toEqual({
      durationMinutes: { value: 360, precision: 'approximate' }
    });
    expect(persisted.temporalReference).toEqual({
      kind: 'unknown',
      timezone: 'America/Sao_Paulo'
    });
    expect(persisted.data).not.toHaveProperty('bedtime');
    expect(persisted.data).not.toHaveProperty('wakeTime');
  });

  it('represents a weekly statement as one period observation', async () => {
    const repository = { create: jest.fn().mockResolvedValue(true) };
    const service = new SleepService(repository as never);
    await service.createFromChat({
      userId: 'user-1',
      sessionId: 'session-1',
      sourceEventId: 'event-2',
      capturedAt: new Date('2026-08-14T12:00:00Z'),
      timezone: 'UTC',
      confidence: 0.95,
      data: {
        durationMinutes: 300,
        durationMinMinutes: null,
        durationMaxMinutes: null,
        bedtime: null,
        wakeTime: null,
        quality: null,
        awakenings: null,
        wakeFeeling: 'cansado',
        date: null,
        period: 'esta semana',
        precision: 'approximate'
      },
      extractorVersion: 'extractor.v1',
      promptVersion: 'sleep.v1'
    });

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.create.mock.calls[0][0].temporalReference).toEqual({
      kind: 'period',
      descriptor: 'esta semana',
      timezone: 'UTC',
      precision: 'approximate'
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
