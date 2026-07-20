import { Model } from 'mongoose';
import { WellbeingObservation } from '../../../../domain/wellbeing-history/entities/wellbeing-observation.entity';
import {
  SaveWellbeingObservationIfAbsentResult,
  WellbeingObservationListCriteria,
  WellbeingObservationRepository
} from '../../../../domain/wellbeing-history/repositories/wellbeing-observation.repository';
import { MongoWellbeingObservationMapper } from '../mappers/wellbeing-observation.mapper';
import { WellbeingObservationDocument } from '../schemas/wellbeing-observation.schema';

export class WellbeingObservationConcurrencyError extends Error {
  constructor() {
    super('Wellbeing observation changed concurrently');
    this.name = 'WellbeingObservationConcurrencyError';
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}

export class MongoWellbeingObservationRepository implements WellbeingObservationRepository {
  constructor(private readonly model: Model<WellbeingObservationDocument>) {}

  async saveIfAbsent(
    userId: string,
    idempotencyKey: string,
    observation: WellbeingObservation
  ): Promise<SaveWellbeingObservationIfAbsentResult> {
    if (observation.userId !== userId || observation.idempotencyKey !== idempotencyKey) {
      throw new Error('Wellbeing observation ownership or idempotency key mismatch');
    }

    try {
      const created = await this.model.create(
        MongoWellbeingObservationMapper.toPersistence(observation)
      );
      return {
        created: true,
        observation: MongoWellbeingObservationMapper.toDomain(created)
      };
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;

      const existing = await this.model
        .findOne({ user_id: userId, idempotency_key: idempotencyKey })
        .exec();
      if (!existing) throw error;

      return {
        created: false,
        observation: MongoWellbeingObservationMapper.toDomain(existing)
      };
    }
  }

  async findById(userId: string, observationId: string): Promise<WellbeingObservation | null> {
    const raw = await this.model.findOne({ _id: observationId, user_id: userId }).exec();
    return raw ? MongoWellbeingObservationMapper.toDomain(raw) : null;
  }

  async list(
    userId: string,
    criteria: WellbeingObservationListCriteria = {}
  ): Promise<WellbeingObservation[]> {
    const filter: Record<string, unknown> = { user_id: userId };

    if (criteria.kinds?.length) filter.kind = { $in: criteria.kinds };
    if (criteria.createdFrom || criteria.createdTo) {
      filter.created_at = {
        ...(criteria.createdFrom ? { $gte: criteria.createdFrom } : {}),
        ...(criteria.createdTo ? { $lte: criteria.createdTo } : {})
      };
    }

    const observations = await this.model.find(filter).sort({ created_at: -1 }).limit(500).exec();
    return observations.map((observation) => MongoWellbeingObservationMapper.toDomain(observation));
  }

  async findMoodSummariesBySourceObservation(
    userId: string,
    sourceObservationId: string
  ): Promise<WellbeingObservation<'mood_daily_summary'>[]> {
    const summaries = await this.model
      .find({
        user_id: userId,
        kind: 'mood_daily_summary',
        'data.source_observation_ids': sourceObservationId
      })
      .exec();

    return summaries.map(
      (summary) =>
        MongoWellbeingObservationMapper.toDomain(
          summary
        ) as WellbeingObservation<'mood_daily_summary'>
    );
  }

  async update(userId: string, observation: WellbeingObservation): Promise<void> {
    if (observation.userId !== userId) {
      throw new Error('Wellbeing observation ownership mismatch');
    }

    const persistence = MongoWellbeingObservationMapper.toPersistence(observation);
    const result = await this.model
      .findOneAndUpdate(
        {
          _id: observation.id.value,
          user_id: userId,
          revision: observation.revision - 1
        },
        {
          $set: {
            data: persistence.data,
            temporal_reference: persistence.temporal_reference,
            provenance_history: persistence.provenance_history,
            revision_history: persistence.revision_history,
            revision: persistence.revision,
            updated_at: persistence.updated_at
          }
        }
      )
      .exec();

    if (!result) throw new WellbeingObservationConcurrencyError();
  }

  async delete(userId: string, observationId: string, expectedRevision: number): Promise<boolean> {
    const result = await this.model
      .deleteOne({ _id: observationId, user_id: userId, revision: expectedRevision })
      .exec();

    return result.deletedCount === 1;
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.model.deleteMany({ user_id: userId }).exec();
  }
}
