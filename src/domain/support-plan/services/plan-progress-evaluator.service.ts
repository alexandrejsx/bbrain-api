import { ProgressStatus } from '../value-objects/support-plan.value-objects';

export interface PlanProgressEvaluator {
  evaluate(planId: string): Promise<ProgressStatus>;
}
