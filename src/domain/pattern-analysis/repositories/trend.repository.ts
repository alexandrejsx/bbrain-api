import { BehavioralTrend } from '../entities/behavioral-trend.entity';

export interface TrendRepository {
  findRecentByUserId(userId: string, limit?: number): Promise<BehavioralTrend[]>;
  save(trend: BehavioralTrend): Promise<void>;
}
