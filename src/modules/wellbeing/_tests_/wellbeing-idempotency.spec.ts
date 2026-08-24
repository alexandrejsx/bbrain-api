import { MoodRepository } from '../../mood/mood.repository';
import { SleepRepository } from '../../sleep/sleep.repository';
import { WellbeingIdempotencyConflictError } from '../wellbeing.types';

const now = new Date('2026-08-14T12:00:00Z');
const temporalReference = {
  kind: 'specific_day' as const,
  localDate: '2026-08-14',
  timezone: 'UTC',
  precision: 'exact' as const
};

function duplicateModel(existing: Record<string, unknown>) {
  return {
    create: jest.fn().mockRejectedValue({ code: 11000 }),
    findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) })
  };
}

function stored(data: Record<string, unknown>, kind = 'mood_event') {
  return {
    _id: 'record-1',
    user_id: 'user-1',
    record_date: '2026-08-14',
    kind,
    data,
    temporal_reference: temporalReference,
    provenance: { source: 'manual' },
    provenance_history: [{ source: 'manual' }],
    revision: 1,
    client_request_id: 'request-1',
    captured_at: now,
    created_at: now,
    updated_at: now
  };
}

describe('manual wellbeing idempotency', () => {
  it('returns the original mood record when the same request is retried', async () => {
    const data = { descriptors: ['ansioso'] };
    const repository = new MoodRepository(duplicateModel(stored(data)) as never);
    await expect(
      repository.create({
        userId: 'user-1',
        recordDate: '2026-08-14',
        kind: 'mood_event',
        data,
        temporalReference,
        provenance: { source: 'manual' },
        provenanceHistory: [{ source: 'manual' }],
        revision: 1,
        clientRequestId: 'request-1',
        capturedAt: now
      })
    ).resolves.toEqual(expect.objectContaining({ id: 'record-1' }));
  });

  it('returns the original sleep record when the same request is retried', async () => {
    const data = { durationMinutes: { value: 360, precision: 'approximate' } };
    const repository = new SleepRepository(duplicateModel(stored(data, 'sleep_record')) as never);
    await expect(
      repository.create({
        userId: 'user-1',
        recordDate: '2026-08-14',
        kind: 'sleep_record',
        data,
        temporalReference,
        provenance: { source: 'manual' },
        provenanceHistory: [{ source: 'manual' }],
        revision: 1,
        clientRequestId: 'request-1',
        capturedAt: now
      })
    ).resolves.toEqual(expect.objectContaining({ id: 'record-1' }));
  });

  it('rejects reusing a manual request id with different content', async () => {
    const repository = new MoodRepository(
      duplicateModel(stored({ descriptors: ['ansioso'] })) as never
    );
    await expect(
      repository.create({
        userId: 'user-1',
        recordDate: '2026-08-14',
        kind: 'mood_event',
        data: { descriptors: ['calmo'] },
        temporalReference,
        provenance: { source: 'manual' },
        provenanceHistory: [{ source: 'manual' }],
        revision: 1,
        clientRequestId: 'request-1',
        capturedAt: now
      })
    ).rejects.toBeInstanceOf(WellbeingIdempotencyConflictError);
  });
});
