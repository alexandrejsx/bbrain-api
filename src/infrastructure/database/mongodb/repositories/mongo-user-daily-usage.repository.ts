import { Injectable } from '@nestjs/common';
import { UserDailyUsage } from '../../../../domain/usage/entities/user-daily-usage.entity';
import { UserDailyUsageRepository } from '../../../../domain/usage/repositories/user-daily-usage.repository';
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

    const exists = await this.baseRepository.findOne(persistence._id);

    if (exists) {
      await this.baseRepository.update(exists._id.toString(), persistence);
      return;
    }

    await this.baseRepository.add(persistence);
  }
}
