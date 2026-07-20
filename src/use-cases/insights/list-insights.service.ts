import { PlanType } from '../../domain/plans/plan-definition';
import { UserRepository } from '../../domain/users/repositories/user.repository';

export const INSIGHTS_POLICY_VERSION = 'insights-read-v1';

export interface InsightListOutput {
  status: 'insufficient_data';
  items: [];
  policyVersion: typeof INSIGHTS_POLICY_VERSION;
}

export class InsightsUserNotFoundError extends Error {
  readonly code = 'INSIGHTS_USER_NOT_FOUND';

  constructor() {
    super('User not found');
    this.name = 'InsightsUserNotFoundError';
  }
}

export class InsightsProPlanRequiredError extends Error {
  readonly code = 'INSIGHTS_PRO_REQUIRED';

  constructor() {
    super('An active Pro plan is required to access insights');
    this.name = 'InsightsProPlanRequiredError';
  }
}

export class ListInsightsService {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: string, now = new Date()): Promise<InsightListOutput> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new InsightsUserNotFoundError();
    }

    if (user.getEffectivePlan(now) !== PlanType.PRO) {
      throw new InsightsProPlanRequiredError();
    }

    return {
      status: 'insufficient_data',
      items: [],
      policyVersion: INSIGHTS_POLICY_VERSION
    };
  }
}
