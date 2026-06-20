import { UserSummary } from '../entities/user-summary.entity';

export interface UserSummaryRepository {
  findByUserId(userId: string): Promise<UserSummary[]>;
  findByPeriod(userId: string, startsAt: Date, endsAt: Date): Promise<UserSummary[]>;
  save(summary: UserSummary): Promise<void>;
}
