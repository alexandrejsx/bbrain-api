import { SupportPlan } from '../entities/support-plan.entity';

export interface SupportPlanRepository {
  findById(id: string): Promise<SupportPlan | null>;
  findActiveByUserId(userId: string): Promise<SupportPlan | null>;
  save(plan: SupportPlan): Promise<void>;
}
