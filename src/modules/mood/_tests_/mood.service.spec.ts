import { InvalidWellbeingRecordError } from '../../wellbeing/wellbeing.types';
import { MoodService } from '../mood.service';

describe('MoodService', () => {
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
      temporalReference: { kind: 'unknown', timezone: 'UTC' }
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
      expect.objectContaining({ primaryEmotion: 'ansioso', intensity: 5 }),
      current.temporalReference,
      expect.objectContaining({ source: 'manual_correction' })
    );
  });
});
