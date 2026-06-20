import { PatternInsight } from '../entities/pattern-insight.entity';

export interface PatternInsightRepository {
  findById(id: string): Promise<PatternInsight | null>;
  findActiveByUserId(userId: string): Promise<PatternInsight[]>;
  save(insight: PatternInsight): Promise<void>;
}
