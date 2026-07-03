import { UserDailyUsage } from '../../../../domain/usage/entities/user-daily-usage.entity';
import { Uuid } from '../../../../domain/shared/uuid.vo';
import { UserDailyUsageDocument, UserDailyUsageMongo } from '../schemas/user-daily-usage.schema';

export class MongoUserDailyUsageMapper {
  static toPersistence(usage: UserDailyUsage): Partial<UserDailyUsageMongo> {
    return {
      _id: usage.id.value,
      user_id: usage.userId,
      plan: usage.plan,
      date_key: usage.dateKey,
      period_start: usage.periodStart,
      period_end: usage.periodEnd,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      total_tokens: usage.totalTokens,
      message_count: usage.messageCount,
      blocked_count: usage.blockedCount,
      created_at: usage.createdAt,
      updated_at: usage.updatedAt
    };
  }

  static toDomain(raw: UserDailyUsageDocument | UserDailyUsageMongo): UserDailyUsage {
    return UserDailyUsage.reconstitute(
      {
        userId: raw.user_id,
        plan: raw.plan,
        dateKey: raw.date_key,
        periodStart: raw.period_start,
        periodEnd: raw.period_end,
        inputTokens: raw.input_tokens ?? 0,
        outputTokens: raw.output_tokens ?? 0,
        totalTokens: raw.total_tokens ?? 0,
        messageCount: raw.message_count ?? 0,
        blockedCount: raw.blocked_count ?? 0,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at
      },
      new Uuid(raw._id)
    );
  }
}
