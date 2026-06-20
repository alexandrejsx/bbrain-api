import { RiskAssessment } from '../entities/risk-assessment.entity';

export interface RiskAssessmentRepository {
  findLatestByUserId(userId: string): Promise<RiskAssessment | null>;
  save(assessment: RiskAssessment): Promise<void>;
}
