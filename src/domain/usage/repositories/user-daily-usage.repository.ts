import { UserDailyUsage } from '../entities/user-daily-usage.entity';

export interface UserDailyUsageRepository {
  findActiveByUserId(userId: string, referenceDate: Date): Promise<UserDailyUsage | null>;
  save(usage: UserDailyUsage): Promise<void>;
}
