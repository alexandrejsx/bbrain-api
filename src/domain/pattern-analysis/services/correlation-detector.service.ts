import { CorrelationAnalysis } from '../entities/correlation-analysis.entity';

export interface CorrelationDetector {
  detect(userId: string): Promise<CorrelationAnalysis[]>;
}
