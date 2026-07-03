import {
  getPlanDefinition,
  BillingInterval,
  BillingCurrency,
  PlanType
} from '../../domain/plans/plan-definition';

const PLAN_PRIORITY: Record<Exclude<PlanType, PlanType.FREE>, number> = {
  [PlanType.STANDARD]: 1,
  [PlanType.PRO]: 2
};

export interface PlanChangeCalculationInput {
  currentPlan?: PlanType;
  currentBillingInterval?: BillingInterval;
  currentCurrency?: BillingCurrency;
  currentPlanAccessUntil?: Date;
  targetPlan: Exclude<PlanType, PlanType.FREE>;
  targetBillingInterval: BillingInterval;
  targetCurrency: BillingCurrency;
  now: Date;
}

export interface PlanChangeCalculation {
  isUpgrade: boolean;
  isDowngrade: boolean;
  creditAmountCents: number;
  targetAmountCents: number;
  amountToPayCents: number;
  accessDays: number;
  shouldCreatePayment: boolean;
  message?: string;
}

export class PlanChangeCalculatorService {
  static readonly MIN_PIX_ADJUSTMENT_AMOUNT_CENTS = 100;

  calculate(input: PlanChangeCalculationInput): PlanChangeCalculation {
    const targetDefinition = getPlanDefinition(input.targetPlan);

    if (!targetDefinition) {
      throw new Error('Invalid target plan');
    }

    const targetAmountCents =
      targetDefinition.prices[input.targetCurrency][input.targetBillingInterval].amount;
    const accessDays = input.targetBillingInterval === BillingInterval.YEARLY ? 365 : 30;
    const activeCurrentPlan =
      input.currentPlan &&
      input.currentPlan !== PlanType.FREE &&
      input.currentPlanAccessUntil &&
      input.currentPlanAccessUntil.getTime() > input.now.getTime()
        ? input.currentPlan
        : undefined;

    if (!activeCurrentPlan || !input.currentPlanAccessUntil || !input.currentBillingInterval) {
      return {
        isUpgrade: true,
        isDowngrade: false,
        creditAmountCents: 0,
        targetAmountCents,
        amountToPayCents: targetAmountCents,
        accessDays,
        shouldCreatePayment: true
      };
    }

    if (
      activeCurrentPlan === input.targetPlan &&
      input.currentBillingInterval === input.targetBillingInterval
    ) {
      return {
        isUpgrade: false,
        isDowngrade: false,
        creditAmountCents: 0,
        targetAmountCents,
        amountToPayCents: 0,
        accessDays,
        shouldCreatePayment: false,
        message: 'Esse plano já está ativo para o ciclo atual.'
      };
    }

    const isIntervalDowngrade =
      input.currentBillingInterval === BillingInterval.YEARLY &&
      input.targetBillingInterval === BillingInterval.MONTHLY;
    const isPlanDowngrade = PLAN_PRIORITY[activeCurrentPlan] > PLAN_PRIORITY[input.targetPlan];

    if (isIntervalDowngrade || isPlanDowngrade) {
      return {
        isUpgrade: false,
        isDowngrade: true,
        creditAmountCents: 0,
        targetAmountCents,
        amountToPayCents: 0,
        accessDays,
        shouldCreatePayment: false,
        message:
          'Seu plano atual continuará ativo até o fim do período pago. Para mudar para um plano inferior, aguarde o fim do ciclo atual.'
      };
    }

    const creditAmountCents = this.calculateProportionalCredit({
      currentPlan: activeCurrentPlan,
      currentBillingInterval: input.currentBillingInterval,
      currentCurrency: input.currentCurrency,
      currentPlanAccessUntil: input.currentPlanAccessUntil,
      now: input.now
    });
    const amountToPayCents = Math.max(0, targetAmountCents - creditAmountCents);

    return {
      isUpgrade: true,
      isDowngrade: false,
      creditAmountCents,
      targetAmountCents,
      amountToPayCents,
      accessDays,
      shouldCreatePayment:
        amountToPayCents >= PlanChangeCalculatorService.MIN_PIX_ADJUSTMENT_AMOUNT_CENTS,
      message:
        input.currentBillingInterval === BillingInterval.MONTHLY &&
        input.targetBillingInterval === BillingInterval.YEARLY
          ? 'O valor proporcional restante do seu plano atual será descontado do plano anual.'
          : 'Você já possui um plano ativo. O valor proporcional restante será descontado, e você pagará apenas a diferença.'
    };
  }

  private calculateProportionalCredit(input: {
    currentPlan: Exclude<PlanType, PlanType.FREE>;
    currentBillingInterval: BillingInterval;
    currentCurrency?: BillingCurrency;
    currentPlanAccessUntil: Date;
    now: Date;
  }): number {
    if (input.currentCurrency && input.currentCurrency !== BillingCurrency.BRL) {
      return 0;
    }

    const currentDefinition = getPlanDefinition(input.currentPlan);

    if (!currentDefinition) {
      return 0;
    }

    const currentAmountCents =
      currentDefinition.prices[BillingCurrency.BRL][input.currentBillingInterval].amount;
    const totalDays = input.currentBillingInterval === BillingInterval.YEARLY ? 365 : 30;
    const remainingMs = input.currentPlanAccessUntil.getTime() - input.now.getTime();

    if (remainingMs <= 0) {
      return 0;
    }

    const remainingDays = Math.min(totalDays, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

    return Math.max(0, Math.floor((currentAmountCents * remainingDays) / totalDays));
  }
}
