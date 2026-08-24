import { MoodSchema } from '../../mood/mood.schema';
import { MoodRepository } from '../../mood/mood.repository';
import { SleepSchema } from '../../sleep/sleep.schema';
import { WellbeingDailyRecordConflictError, type WellbeingRecord } from '../wellbeing.types';
import {
  normalizeTemporalReference,
  recordDateFromTemporalReference
} from '../wellbeing.validation';

const temporalReference = {
  kind: 'specific_day' as const,
  localDate: '2026-08-17',
  timezone: 'America/Sao_Paulo',
  precision: 'exact' as const
};

describe('daily wellbeing record uniqueness', () => {
  it('rejects a second mood record for the same user and local date', async () => {
    const model = {
      create: jest.fn().mockRejectedValue({ code: 11000 }),
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      exists: jest.fn().mockResolvedValue(true)
    };
    const repository = new MoodRepository(model as never);

    await expect(repository.create(moodInput('user-1'))).rejects.toEqual(
      expect.objectContaining<Partial<WellbeingDailyRecordConflictError>>({
        recordDate: '2026-08-17'
      })
    );
  });

  it('normalizes equivalent instants to the selected local calendar day', () => {
    const first = normalizeTemporalReference({
      kind: 'moment',
      at: '2026-08-17T01:30:00.000Z',
      timezone: 'America/Sao_Paulo',
      precision: 'exact'
    });
    const second = normalizeTemporalReference({
      kind: 'moment',
      at: '2026-08-16T22:30:00.000-03:00',
      timezone: 'America/Sao_Paulo',
      precision: 'exact'
    });

    expect(recordDateFromTemporalReference(first)).toBe('2026-08-16');
    expect(recordDateFromTemporalReference(second)).toBe('2026-08-16');
  });

  it('uses a compound unique index so different users may record the same day', () => {
    const hasDailyUniqueIndex = (indexes: ReturnType<typeof MoodSchema.indexes>) =>
      indexes.some(
        ([fields, options]) =>
          fields.user_id === 1 && fields.record_date === 1 && options.unique === true
      );

    expect(hasDailyUniqueIndex(MoodSchema.indexes())).toBe(true);
    expect(hasDailyUniqueIndex(SleepSchema.indexes())).toBe(true);
    expect(moodInput('user-1').recordDate).toBe(moodInput('user-2').recordDate);
    expect(moodInput('user-1').userId).not.toBe(moodInput('user-2').userId);
  });
});

function moodInput(userId: string): Omit<WellbeingRecord, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    userId,
    recordDate: '2026-08-17',
    kind: 'mood_event',
    data: { moodLevel: 'good', moodScore: 7.5 },
    temporalReference,
    provenance: { source: 'manual' },
    provenanceHistory: [{ source: 'manual' }],
    revision: 1,
    clientRequestId: `${userId}-request`,
    capturedAt: new Date('2026-08-17T12:00:00.000Z')
  };
}
