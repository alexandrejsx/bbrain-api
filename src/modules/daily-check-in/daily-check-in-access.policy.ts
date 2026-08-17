import { Injectable } from '@nestjs/common';
import { PlanType } from '../../domain/plans/plan-definition';
import { User } from '../../domain/users/entities/user.entity';
import { DailyCheckInAccessReason } from './daily-check-in.types';

const TRIAL_DAYS = 7;

@Injectable()
export class DailyCheckInAccessPolicy {
  resolve(
    user: User,
    referenceAt = new Date()
  ): {
    available: boolean;
    accessReason: DailyCheckInAccessReason;
  } {
    const trialEndsAt = new Date(user.createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    if (referenceAt.getTime() < trialEndsAt.getTime()) {
      return { available: true, accessReason: 'trial' };
    }
    if (user.getEffectivePlan(referenceAt) !== PlanType.FREE) {
      return { available: true, accessReason: 'plan' };
    }
    return { available: false, accessReason: 'locked' };
  }
}
