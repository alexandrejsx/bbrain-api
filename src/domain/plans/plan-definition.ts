export enum PlanType {
  FREE = 'free',
  STANDARD = 'standard',
  PRO = 'pro'
}

export enum BillingInterval {
  MONTHLY = 'monthly',
  YEARLY = 'yearly'
}

export enum BillingCurrency {
  BRL = 'brl',
  USD = 'usd'
}

export enum PaymentProviderType {
  STRIPE = 'stripe',
  ASAAS = 'asaas'
}

export enum PaymentMethodType {
  CARD = 'card',
  PIX = 'pix'
}

export enum SubscriptionStatus {
  NONE = 'none',
  PENDING = 'pending',
  INCOMPLETE = 'incomplete',
  TRIALING = 'trialing',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  UNPAID = 'unpaid',
  INCOMPLETE_EXPIRED = 'incomplete_expired',
  EXPIRED = 'expired'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  EXPIRED = 'expired',
  CANCELED = 'canceled',
  REFUNDED = 'refunded'
}

export type LegacyPlanType = 'premium';

export interface PlanPriceDefinition {
  amount: number;
  currency: BillingCurrency;
  interval: BillingInterval;
  displayMonthly: string;
  billedAs: string;
  stripePriceEnvKey?: string;
  pixAmount?: number;
}

export interface PlanDefinition {
  id: PlanType;
  name: string;
  publicName: string;
  description: string;
  dailyTokenLimit: number;
  dailyMessageLimit: number;
  maxUserMessageLength: number;
  features: string[];
  prices: Record<BillingCurrency, Record<BillingInterval, PlanPriceDefinition>>;
}

export type PublicPlanDefinition = Omit<PlanDefinition, 'prices'> & {
  prices: Record<
    BillingCurrency,
    Record<BillingInterval, Omit<PlanPriceDefinition, 'stripePriceEnvKey'>>
  >;
};

const freePrices = {
  [BillingCurrency.BRL]: {
    [BillingInterval.MONTHLY]: {
      amount: 0,
      currency: BillingCurrency.BRL,
      interval: BillingInterval.MONTHLY,
      displayMonthly: 'R$ 0',
      billedAs: 'sem cobrança'
    },
    [BillingInterval.YEARLY]: {
      amount: 0,
      currency: BillingCurrency.BRL,
      interval: BillingInterval.YEARLY,
      displayMonthly: 'R$ 0',
      billedAs: 'sem cobrança'
    }
  },
  [BillingCurrency.USD]: {
    [BillingInterval.MONTHLY]: {
      amount: 0,
      currency: BillingCurrency.USD,
      interval: BillingInterval.MONTHLY,
      displayMonthly: 'US$ 0',
      billedAs: 'no charge'
    },
    [BillingInterval.YEARLY]: {
      amount: 0,
      currency: BillingCurrency.USD,
      interval: BillingInterval.YEARLY,
      displayMonthly: 'US$ 0',
      billedAs: 'no charge'
    }
  }
} satisfies PlanDefinition['prices'];

export const PLAN_DEFINITIONS: Record<PlanType, PlanDefinition> = {
  [PlanType.FREE]: {
    id: PlanType.FREE,
    name: 'Free',
    publicName: 'Free',
    description: 'Para experimentar o BBrain com calma.',
    dailyTokenLimit: 30_000,
    dailyMessageLimit: 20,
    maxUserMessageLength: 2_000,
    features: [
      'Conversas diárias limitadas',
      'Apoio emocional básico',
      'Registro de perfil',
      'Histórico/resumo limitado'
    ],
    prices: freePrices
  },
  [PlanType.STANDARD]: {
    id: PlanType.STANDARD,
    name: 'Standard',
    publicName: 'Standard',
    description: 'Para usar o BBrain com mais frequência no dia a dia.',
    dailyTokenLimit: 150_000,
    dailyMessageLimit: 100,
    maxUserMessageLength: 6_000,
    features: [
      'Mais mensagens por dia',
      'Maior contexto nas conversas',
      'Melhor continuidade entre conversas',
      'Preparado para diário e insights futuros'
    ],
    prices: {
      [BillingCurrency.BRL]: {
        [BillingInterval.MONTHLY]: {
          amount: 1_990,
          currency: BillingCurrency.BRL,
          interval: BillingInterval.MONTHLY,
          displayMonthly: 'R$ 19,90/mês',
          billedAs: 'cobrado mensalmente',
          stripePriceEnvKey: 'STRIPE_PRICE_STANDARD_MONTHLY_BRL',
          pixAmount: 1_990
        },
        [BillingInterval.YEARLY]: {
          amount: 17_880,
          currency: BillingCurrency.BRL,
          interval: BillingInterval.YEARLY,
          displayMonthly: 'R$ 14,90/mês',
          billedAs: 'cobrado R$ 178,80/ano',
          stripePriceEnvKey: 'STRIPE_PRICE_STANDARD_YEARLY_BRL',
          pixAmount: 17_880
        }
      },
      [BillingCurrency.USD]: {
        [BillingInterval.MONTHLY]: {
          amount: 599,
          currency: BillingCurrency.USD,
          interval: BillingInterval.MONTHLY,
          displayMonthly: 'US$ 5.99/mês',
          billedAs: 'billed monthly',
          stripePriceEnvKey: 'STRIPE_PRICE_STANDARD_MONTHLY_USD'
        },
        [BillingInterval.YEARLY]: {
          amount: 5_988,
          currency: BillingCurrency.USD,
          interval: BillingInterval.YEARLY,
          displayMonthly: 'US$ 4.99/mês',
          billedAs: 'billed US$ 59.88/year',
          stripePriceEnvKey: 'STRIPE_PRICE_STANDARD_YEARLY_USD'
        }
      }
    }
  },
  [PlanType.PRO]: {
    id: PlanType.PRO,
    name: 'Pro',
    publicName: 'Pro',
    description: 'Para conversas mais longas, mais contexto e recursos avançados.',
    dailyTokenLimit: 500_000,
    dailyMessageLimit: 300,
    maxUserMessageLength: 12_000,
    features: [
      'Alto limite diário',
      'Conversas mais longas',
      'Maior profundidade de contexto',
      'Preparado para relatórios e recursos avançados'
    ],
    prices: {
      [BillingCurrency.BRL]: {
        [BillingInterval.MONTHLY]: {
          amount: 4_990,
          currency: BillingCurrency.BRL,
          interval: BillingInterval.MONTHLY,
          displayMonthly: 'R$ 49,90/mês',
          billedAs: 'cobrado mensalmente',
          stripePriceEnvKey: 'STRIPE_PRICE_PRO_MONTHLY_BRL',
          pixAmount: 4_990
        },
        [BillingInterval.YEARLY]: {
          amount: 47_880,
          currency: BillingCurrency.BRL,
          interval: BillingInterval.YEARLY,
          displayMonthly: 'R$ 39,90/mês',
          billedAs: 'cobrado R$ 478,80/ano',
          stripePriceEnvKey: 'STRIPE_PRICE_PRO_YEARLY_BRL',
          pixAmount: 47_880
        }
      },
      [BillingCurrency.USD]: {
        [BillingInterval.MONTHLY]: {
          amount: 1_499,
          currency: BillingCurrency.USD,
          interval: BillingInterval.MONTHLY,
          displayMonthly: 'US$ 14.99/mês',
          billedAs: 'billed monthly',
          stripePriceEnvKey: 'STRIPE_PRICE_PRO_MONTHLY_USD'
        },
        [BillingInterval.YEARLY]: {
          amount: 14_388,
          currency: BillingCurrency.USD,
          interval: BillingInterval.YEARLY,
          displayMonthly: 'US$ 11.99/mês',
          billedAs: 'billed US$ 143.88/year',
          stripePriceEnvKey: 'STRIPE_PRICE_PRO_YEARLY_USD'
        }
      }
    }
  }
};

export const DEFAULT_PLAN = PlanType.FREE;

export function normalizePlanType(value: unknown): PlanType | undefined {
  if (value === 'premium') {
    return PlanType.PRO;
  }

  return Object.values(PlanType).includes(value as PlanType) ? (value as PlanType) : undefined;
}

export function isPlanType(value: unknown): value is PlanType {
  return normalizePlanType(value) === value;
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return Object.values(BillingInterval).includes(value as BillingInterval);
}

export function isBillingCurrency(value: unknown): value is BillingCurrency {
  return Object.values(BillingCurrency).includes(value as BillingCurrency);
}

export function isPaymentProviderType(value: unknown): value is PaymentProviderType {
  return Boolean(normalizePaymentProviderType(value));
}

export function isPaymentMethodType(value: unknown): value is PaymentMethodType {
  return Object.values(PaymentMethodType).includes(value as PaymentMethodType);
}

export function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return Object.values(SubscriptionStatus).includes(value as SubscriptionStatus);
}

export function normalizePaymentProviderType(value: unknown): PaymentProviderType | undefined {
  if (value === 'woovi') {
    return PaymentProviderType.ASAAS;
  }

  return Object.values(PaymentProviderType).includes(value as PaymentProviderType)
    ? (value as PaymentProviderType)
    : undefined;
}

export function getPlanDefinition(plan: PlanType): PlanDefinition | undefined {
  return PLAN_DEFINITIONS[plan];
}

export function toPublicPlanDefinition(plan: PlanDefinition): PublicPlanDefinition {
  return {
    ...plan,
    prices: Object.fromEntries(
      Object.entries(plan.prices).map(([currency, intervals]) => [
        currency,
        Object.fromEntries(
          Object.entries(intervals).map(([interval, price]) => {
            const publicPrice = { ...price };
            delete publicPrice.stripePriceEnvKey;

            return [interval, publicPrice];
          })
        )
      ])
    ) as PublicPlanDefinition['prices']
  };
}

export function getPublicPlanDefinitions(): PublicPlanDefinition[] {
  return Object.values(PLAN_DEFINITIONS).map(toPublicPlanDefinition);
}
