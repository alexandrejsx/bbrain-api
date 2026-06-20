import { BehavioralTrend } from '../entities/behavioral-trend.entity';

export interface TrendDetector {
  detect(userId: string): Promise<BehavioralTrend[]>;
}
