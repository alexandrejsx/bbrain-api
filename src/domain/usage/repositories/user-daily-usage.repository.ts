import { UserDailyUsage } from '../entities/user-daily-usage.entity';
import { PlanType } from '../../plans/plan-definition';
import { LlmUsage } from '../value-objects/llm-usage';

export interface AtomicLlmUsageRegistration {
  usageId: string;
  usage: LlmUsage;
  incrementMessageCount: boolean;
  dailyTokenLimit: number;
  dailyMessageLimit: number;
  lockPeriodEnd: Date;
  updatedAt: Date;
}

export interface AtomicMessageReservation {
  usageId: string;
  dailyTokenLimit: number;
  dailyMessageLimit: number;
  lockPeriodEnd: Date;
  updatedAt: Date;
}

export interface UserDailyUsageRepository {
  findActiveByUserId(userId: string, referenceDate: Date): Promise<UserDailyUsage | null>;
  save(usage: UserDailyUsage): Promise<void>;
  updatePlanAtomic(
    usageId: string,
    plan: PlanType,
    updatedAt: Date
  ): Promise<UserDailyUsage | null>;
  registerBlockedAtomic(
    usageId: string,
    lockPeriodEnd: Date | undefined,
    updatedAt: Date
  ): Promise<UserDailyUsage | null>;
  registerLlmUsageAtomic(input: AtomicLlmUsageRegistration): Promise<UserDailyUsage>;
  reserveMessageAtomic(input: AtomicMessageReservation): Promise<UserDailyUsage | null>;
  releaseMessageAtomic(usageId: string, updatedAt: Date): Promise<void>;
}
