import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import {
  BillingCurrency,
  BillingInterval,
  getPlanDefinition,
  getPublicPlanDefinitions,
  isBillingCurrency,
  isBillingInterval,
  isPaymentMethodType,
  normalizePlanType,
  PaymentMethodType,
  PlanDefinition,
  PlanType,
  PublicPlanDefinition
} from '../../domain/plans/plan-definition';

export interface ResolvedStripePrice {
  plan: Exclude<PlanType, PlanType.FREE>;
  billingInterval: BillingInterval;
  currency: BillingCurrency;
  priceId: string;
}

export class PlansService {
  getPublicPlans(): PublicPlanDefinition[] {
    return getPublicPlanDefinitions();
  }

  getPlanDefinition(plan: PlanType): PlanDefinition {
    const definition = getPlanDefinition(plan);

    if (!definition) {
      throw new BadRequestException('Plano inválido.');
    }

    return definition;
  }

  validatePlan(plan: unknown): PlanType {
    const normalizedPlan = normalizePlanType(plan);

    if (!normalizedPlan) {
      throw new BadRequestException('Plano inválido.');
    }

    return normalizedPlan;
  }

  validatePaidPlan(plan: unknown): Exclude<PlanType, PlanType.FREE> {
    const normalizedPlan = this.validatePlan(plan);

    if (normalizedPlan === PlanType.FREE) {
      throw new BadRequestException('O plano Free não usa checkout.');
    }

    return normalizedPlan;
  }

  validateBillingInterval(interval: unknown): BillingInterval {
    if (!isBillingInterval(interval)) {
      throw new BadRequestException('Intervalo de cobrança inválido.');
    }

    return interval;
  }

  validateBillingCurrency(currency: unknown): BillingCurrency {
    if (!isBillingCurrency(currency)) {
      throw new BadRequestException('Moeda inválida.');
    }

    return currency;
  }

  validatePaymentMethod(paymentMethod: unknown): PaymentMethodType {
    if (!isPaymentMethodType(paymentMethod)) {
      throw new BadRequestException('Método de pagamento inválido.');
    }

    return paymentMethod;
  }

  getStripePriceId(
    plan: Exclude<PlanType, PlanType.FREE>,
    billingInterval: BillingInterval,
    currency: BillingCurrency
  ): string {
    const definition = this.getPlanDefinition(plan);
    const price = definition.prices[currency]?.[billingInterval];
    const envKey = price?.stripePriceEnvKey;
    const priceId = envKey ? process.env[envKey] : undefined;

    if (!priceId) {
      throw new ServiceUnavailableException('O checkout deste plano ainda não está configurado.');
    }

    return priceId;
  }

  getPixAmount(
    plan: Exclude<PlanType, PlanType.FREE>,
    billingInterval: BillingInterval,
    currency: BillingCurrency
  ): number {
    if (currency !== BillingCurrency.BRL) {
      throw new BadRequestException('Pix está disponível apenas em BRL.');
    }

    const definition = this.getPlanDefinition(plan);
    const amount = definition.prices[BillingCurrency.BRL]?.[billingInterval]?.pixAmount;

    if (!amount || amount <= 0) {
      throw new ServiceUnavailableException(
        'Este método de pagamento ainda não está disponível. Tente outro método ou aguarde a configuração.'
      );
    }

    return amount;
  }

  getPlanLimits(plan: PlanType) {
    const definition = this.getPlanDefinition(plan);

    return {
      dailyTokenLimit: definition.dailyTokenLimit,
      dailyMessageLimit: definition.dailyMessageLimit,
      maxUserMessageLength: definition.maxUserMessageLength
    };
  }

  resolvePlanFromStripePriceId(priceId: string): ResolvedStripePrice | null {
    for (const plan of [PlanType.STANDARD, PlanType.PRO] as const) {
      const definition = this.getPlanDefinition(plan);

      for (const currency of Object.values(BillingCurrency)) {
        for (const billingInterval of Object.values(BillingInterval)) {
          const envKey = definition.prices[currency][billingInterval].stripePriceEnvKey;

          if (envKey && process.env[envKey] === priceId) {
            return {
              plan,
              billingInterval,
              currency,
              priceId
            };
          }
        }
      }
    }

    return null;
  }
}
