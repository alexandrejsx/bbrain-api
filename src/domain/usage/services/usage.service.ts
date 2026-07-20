import {
  getPlanDefinition,
  isPlanType,
  PlanDefinition,
  PlanType
} from '../../plans/plan-definition';
import { UserRepository } from '../../users/repositories/user.repository';
import { UserDailyUsage } from '../entities/user-daily-usage.entity';
import { UserDailyUsageRepository } from '../repositories/user-daily-usage.repository';
import { LlmUsage } from '../value-objects/llm-usage';

export type UsageLimitErrorCode =
  | 'INVALID_PLAN'
  | 'USAGE_TOKEN_LIMIT_REACHED'
  | 'USAGE_MESSAGE_LIMIT_REACHED'
  | 'USER_MESSAGE_TOO_LONG';

export interface UsageSummary {
  plan: PlanType;
  planName: string;
  dateKey: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  dailyTokenLimit: number;
  messageCount: number;
  dailyMessageLimit: number;
  tokenUsagePercentage: number;
  messageUsagePercentage: number;
  remainingTokens: number;
  remainingMessages: number;
  periodEnd: string;
}

export interface UsageMessageReservation {
  usageId: string;
  dailyTokenLimit: number;
  dailyMessageLimit: number;
}

export interface UsageLimitErrorDetails {
  plan?: PlanType;
  periodEnd?: string;
  usage?: UsageSummary;
  maxUserMessageLength?: number;
}

export class UsageLimitError extends Error {
  constructor(
    readonly code: UsageLimitErrorCode,
    message: string,
    readonly details: UsageLimitErrorDetails = {}
  ) {
    super(message);
    this.name = 'UsageLimitError';
  }
}

export class UsageUserNotFoundError extends Error {
  constructor() {
    super('User not found');
    this.name = 'UsageUserNotFoundError';
  }
}

interface UsagePeriod {
  dateKey: string;
  periodStart: Date;
  periodEnd: Date;
}

const USAGE_WINDOW_HOURS = 24;

export class UsageService {
  constructor(
    private readonly usageRepository: UserDailyUsageRepository,
    private readonly userRepository: UserRepository,
    private readonly nowProvider: () => Date = () => new Date()
  ) {}

  async getCurrentUsage(userId: string): Promise<UserDailyUsage> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new UsageUserNotFoundError();
    }

    const now = this.nowProvider();
    const effectivePlan = user.getEffectivePlan(now);
    const existingUsage = await this.usageRepository.findActiveByUserId(userId, now);

    if (existingUsage) {
      if (existingUsage.plan !== effectivePlan) {
        return (
          (await this.usageRepository.updatePlanAtomic(
            existingUsage.id.value,
            effectivePlan,
            now
          )) ?? existingUsage
        );
      }

      return existingUsage;
    }

    const usage = UserDailyUsage.create({
      userId,
      plan: effectivePlan,
      ...getUsagePeriod(now),
      createdAt: now,
      updatedAt: now
    });

    await this.usageRepository.save(usage);
    return (await this.usageRepository.findActiveByUserId(userId, now)) ?? usage;
  }

  async getUsageSummary(userId: string): Promise<UsageSummary> {
    const usage = await this.getCurrentUsage(userId);
    const planDefinition = this.resolvePlanDefinition(usage.plan);

    return this.buildUsageSummary(usage, planDefinition);
  }

  async assertCanSendMessage(userId: string, message: string): Promise<UsageMessageReservation> {
    const usage = await this.getCurrentUsage(userId);
    const planDefinition = await this.resolvePlanDefinitionOrBlock(usage);

    if (message.length > planDefinition.maxUserMessageLength) {
      await this.blockWithUsageError(usage, {
        code: 'USER_MESSAGE_TOO_LONG',
        message:
          'Sua mensagem ficou um pouco longa para o plano atual. Tente resumir ou escolha um plano com mensagens maiores.',
        planDefinition,
        details: {
          maxUserMessageLength: planDefinition.maxUserMessageLength
        }
      });
    }

    if (usage.totalTokens >= planDefinition.dailyTokenLimit) {
      await this.blockWithUsageError(usage, {
        code: 'USAGE_TOKEN_LIMIT_REACHED',
        message:
          'Você chegou ao limite diário de uso do seu plano. Para manter a experiência estável, novas mensagens estarão disponíveis no próximo ciclo.',
        planDefinition
      });
    }

    if (usage.messageCount >= planDefinition.dailyMessageLimit) {
      await this.blockWithUsageError(usage, {
        code: 'USAGE_MESSAGE_LIMIT_REACHED',
        message:
          'Você chegou ao limite diário do seu plano. Você pode continuar amanhã ou escolher um plano com mais conversas.',
        planDefinition
      });
    }

    const now = this.nowProvider();
    const reserved = await this.usageRepository.reserveMessageAtomic({
      usageId: usage.id.value,
      dailyTokenLimit: planDefinition.dailyTokenLimit,
      dailyMessageLimit: planDefinition.dailyMessageLimit,
      lockPeriodEnd: getLockedPeriodEnd(now),
      updatedAt: now
    });
    if (!reserved) {
      const current = (await this.usageRepository.findActiveByUserId(userId, now)) ?? usage;
      const tokenLimitReached = current.totalTokens >= planDefinition.dailyTokenLimit;
      await this.blockWithUsageError(current, {
        code: tokenLimitReached ? 'USAGE_TOKEN_LIMIT_REACHED' : 'USAGE_MESSAGE_LIMIT_REACHED',
        message: tokenLimitReached
          ? 'Você chegou ao limite diário de uso do seu plano. Para manter a experiência estável, novas mensagens estarão disponíveis no próximo ciclo.'
          : 'Você chegou ao limite diário do seu plano. Você pode continuar amanhã ou escolher um plano com mais conversas.',
        planDefinition
      });
      throw new Error('Usage limit handling did not throw');
    }

    return {
      usageId: reserved.id.value,
      dailyTokenLimit: planDefinition.dailyTokenLimit,
      dailyMessageLimit: planDefinition.dailyMessageLimit
    };
  }

  async releaseMessageReservation(reservation: UsageMessageReservation): Promise<void> {
    await this.usageRepository.releaseMessageAtomic(reservation.usageId, this.nowProvider());
  }

  async registerReservedLlmUsage(
    reservation: UsageMessageReservation,
    llmUsage: LlmUsage
  ): Promise<void> {
    const now = this.nowProvider();
    await this.usageRepository.registerLlmUsageAtomic({
      usageId: reservation.usageId,
      usage: llmUsage,
      incrementMessageCount: false,
      dailyTokenLimit: reservation.dailyTokenLimit,
      dailyMessageLimit: reservation.dailyMessageLimit,
      lockPeriodEnd: getLockedPeriodEnd(now),
      updatedAt: now
    });
  }

  async registerLlmUsage(userId: string, llmUsage: LlmUsage): Promise<void> {
    await this.registerUsage(userId, llmUsage, true);
  }

  async registerAuxiliaryLlmUsage(userId: string, llmUsage: LlmUsage): Promise<void> {
    await this.registerUsage(userId, llmUsage, false);
  }

  private async registerUsage(
    userId: string,
    llmUsage: LlmUsage,
    incrementMessageCount: boolean
  ): Promise<void> {
    const usage = await this.getCurrentUsage(userId);
    const planDefinition = this.resolvePlanDefinition(usage.plan);
    const now = this.nowProvider();

    await this.usageRepository.registerLlmUsageAtomic({
      usageId: usage.id.value,
      usage: llmUsage,
      incrementMessageCount,
      dailyTokenLimit: planDefinition.dailyTokenLimit,
      dailyMessageLimit: planDefinition.dailyMessageLimit,
      lockPeriodEnd: getLockedPeriodEnd(now),
      updatedAt: now
    });
  }

  private resolvePlanDefinition(plan: PlanType): PlanDefinition {
    if (!isPlanType(plan)) {
      throw new UsageLimitError('INVALID_PLAN', 'Plano de uso inválido.', {
        plan
      });
    }

    const planDefinition = getPlanDefinition(plan);

    if (!planDefinition) {
      throw new UsageLimitError('INVALID_PLAN', 'Plano de uso inválido.', {
        plan
      });
    }

    return planDefinition;
  }

  private async resolvePlanDefinitionOrBlock(usage: UserDailyUsage): Promise<PlanDefinition> {
    try {
      return this.resolvePlanDefinition(usage.plan);
    } catch (error) {
      if (error instanceof UsageLimitError && error.code === 'INVALID_PLAN') {
        const now = this.nowProvider();
        const updated =
          (await this.usageRepository.registerBlockedAtomic(usage.id.value, undefined, now)) ??
          usage;

        throw new UsageLimitError(error.code, error.message, {
          plan: updated.plan,
          periodEnd: updated.periodEnd.toISOString()
        });
      }

      throw error;
    }
  }

  private async blockWithUsageError(
    usage: UserDailyUsage,
    input: {
      code: Exclude<UsageLimitErrorCode, 'INVALID_PLAN'>;
      message: string;
      planDefinition: PlanDefinition;
      details?: Omit<UsageLimitErrorDetails, 'plan' | 'periodEnd' | 'usage'>;
    }
  ): Promise<never> {
    const now = this.nowProvider();

    const hasReachedMessageLimit = usage.messageCount >= input.planDefinition.dailyMessageLimit;
    const hasReachedTokenLimit = usage.totalTokens >= input.planDefinition.dailyTokenLimit;
    const lockPeriodEnd =
      hasReachedMessageLimit || hasReachedTokenLimit ? getLockedPeriodEnd(now) : undefined;
    const updated =
      (await this.usageRepository.registerBlockedAtomic(usage.id.value, lockPeriodEnd, now)) ??
      usage;

    throw new UsageLimitError(input.code, input.message, {
      plan: updated.plan,
      periodEnd: updated.periodEnd.toISOString(),
      usage: this.buildUsageSummary(updated, input.planDefinition),
      ...input.details
    });
  }

  private buildUsageSummary(usage: UserDailyUsage, planDefinition: PlanDefinition): UsageSummary {
    return {
      plan: usage.plan,
      planName: planDefinition.name,
      dateKey: usage.dateKey,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      dailyTokenLimit: planDefinition.dailyTokenLimit,
      messageCount: usage.messageCount,
      dailyMessageLimit: planDefinition.dailyMessageLimit,
      tokenUsagePercentage: percentage(usage.totalTokens, planDefinition.dailyTokenLimit),
      messageUsagePercentage: percentage(usage.messageCount, planDefinition.dailyMessageLimit),
      remainingTokens: Math.max(0, planDefinition.dailyTokenLimit - usage.totalTokens),
      remainingMessages: Math.max(0, planDefinition.dailyMessageLimit - usage.messageCount),
      periodEnd: usage.periodEnd.toISOString()
    };
  }
}

export function getUsagePeriod(referenceDate: Date): UsagePeriod {
  const periodStart = floorToUtcHour(referenceDate);

  return {
    dateKey: buildUsageDateKey(periodStart),
    periodStart,
    periodEnd: getLockedPeriodEnd(referenceDate)
  };
}

function percentage(value: number, limit: number): number {
  if (limit <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((value / limit) * 100));
}

function getLockedPeriodEnd(referenceDate: Date): Date {
  const lockedStart = floorToUtcHour(referenceDate);
  return new Date(lockedStart.getTime() + USAGE_WINDOW_HOURS * 60 * 60 * 1000);
}

function floorToUtcHour(referenceDate: Date): Date {
  return new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
      referenceDate.getUTCHours()
    )
  );
}

function buildUsageDateKey(referenceDate: Date): string {
  return `${referenceDate.getUTCFullYear()}-${pad2(referenceDate.getUTCMonth() + 1)}-${pad2(
    referenceDate.getUTCDate()
  )}T${pad2(referenceDate.getUTCHours())}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}
