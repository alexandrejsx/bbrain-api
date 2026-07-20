import { Injectable } from '@nestjs/common';
import { UserDailyUsage } from '../../../../domain/usage/entities/user-daily-usage.entity';
import { PlanType } from '../../../../domain/plans/plan-definition';
import { UserDailyUsageRepository } from '../../../../domain/usage/repositories/user-daily-usage.repository';
import {
  AtomicLlmUsageRegistration,
  AtomicMessageReservation
} from '../../../../domain/usage/repositories/user-daily-usage.repository';
import { normalizeLlmUsage } from '../../../../domain/usage/value-objects/llm-usage';
import { MongoUserDailyUsageMapper } from '../mappers/user-daily-usage.mapper';
import { MongodbRepository } from '../mongodb.repository';
import { UserDailyUsageDocument } from '../schemas/user-daily-usage.schema';

@Injectable()
export class MongoUserDailyUsageRepository implements UserDailyUsageRepository {
  constructor(private readonly baseRepository: MongodbRepository<UserDailyUsageDocument>) {}

  async findActiveByUserId(userId: string, referenceDate: Date): Promise<UserDailyUsage | null> {
    const [doc] = await this.baseRepository.findAll(
      {
        user_id: userId,
        period_end: { $gt: referenceDate }
      },
      { period_end: -1 },
      1
    );

    return doc ? MongoUserDailyUsageMapper.toDomain(doc) : null;
  }

  async save(usage: UserDailyUsage): Promise<void> {
    const persistence = MongoUserDailyUsageMapper.toPersistence(usage);

    if (!persistence._id) {
      throw new Error('Cannot persist user daily usage without id');
    }

    try {
      await this.baseRepository.add(persistence);
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
  }

  async updatePlanAtomic(
    usageId: string,
    plan: PlanType,
    updatedAt: Date
  ): Promise<UserDailyUsage | null> {
    const updated = await this.baseRepository.findOneAndUpdate(
      { _id: usageId },
      { $set: { plan, updated_at: updatedAt } }
    );

    return updated ? MongoUserDailyUsageMapper.toDomain(updated) : null;
  }

  async registerBlockedAtomic(
    usageId: string,
    lockPeriodEnd: Date | undefined,
    updatedAt: Date
  ): Promise<UserDailyUsage | null> {
    const updated = await this.baseRepository.findOneAndUpdate(
      { _id: usageId },
      {
        $inc: { blocked_count: 1 },
        ...(lockPeriodEnd ? { $max: { period_end: lockPeriodEnd } } : {}),
        $set: { updated_at: updatedAt }
      }
    );

    return updated ? MongoUserDailyUsageMapper.toDomain(updated) : null;
  }

  async registerLlmUsageAtomic(input: AtomicLlmUsageRegistration): Promise<UserDailyUsage> {
    const usage = normalizeLlmUsage(input.usage);
    const messageIncrement = input.incrementMessageCount ? 1 : 0;
    const nextTotalTokens = { $add: [{ $ifNull: ['$total_tokens', 0] }, usage.totalTokens] };
    const nextMessageCount = { $add: [{ $ifNull: ['$message_count', 0] }, messageIncrement] };
    const updated = await this.baseRepository.update(input.usageId, [
      {
        $set: {
          input_tokens: { $add: [{ $ifNull: ['$input_tokens', 0] }, usage.inputTokens] },
          output_tokens: { $add: [{ $ifNull: ['$output_tokens', 0] }, usage.outputTokens] },
          total_tokens: nextTotalTokens,
          message_count: nextMessageCount,
          period_end: {
            $cond: [
              {
                $or: [
                  { $gte: [nextTotalTokens, input.dailyTokenLimit] },
                  { $gte: [nextMessageCount, input.dailyMessageLimit] }
                ]
              },
              { $max: ['$period_end', input.lockPeriodEnd] },
              '$period_end'
            ]
          },
          updated_at: input.updatedAt
        }
      }
    ] as never);

    if (!updated) throw new Error('Cannot register usage for a missing usage period');
    return MongoUserDailyUsageMapper.toDomain(updated);
  }

  async reserveMessageAtomic(input: AtomicMessageReservation): Promise<UserDailyUsage | null> {
    const updated = await this.baseRepository.findOneAndUpdate(
      {
        _id: input.usageId,
        total_tokens: { $lt: input.dailyTokenLimit },
        message_count: { $lt: input.dailyMessageLimit }
      },
      [
        {
          $set: {
            message_count: { $add: [{ $ifNull: ['$message_count', 0] }, 1] },
            updated_at: input.updatedAt
          }
        }
      ] as never
    );

    return updated ? MongoUserDailyUsageMapper.toDomain(updated) : null;
  }

  async releaseMessageAtomic(usageId: string, updatedAt: Date): Promise<void> {
    await this.baseRepository.findOneAndUpdate(
      { _id: usageId, message_count: { $gt: 0 } },
      { $inc: { message_count: -1 }, $set: { updated_at: updatedAt } }
    );
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
