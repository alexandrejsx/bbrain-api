import {
  BillingCurrency,
  BillingInterval,
  PaymentProviderType,
  PlanType,
  SubscriptionStatus
} from '../../plans/plan-definition';
import { Uuid } from '../../shared/uuid.vo';

export interface UserSubscriptionProps {
  userId: string;
  provider: PaymentProviderType;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  providerPriceId?: string;
  plan: PlanType;
  billingInterval: BillingInterval;
  currency: BillingCurrency;
  status: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  cancelAt?: Date;
  canceledAt?: Date;
  latestInvoiceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserSubscription {
  readonly id: Uuid;

  private constructor(
    private readonly props: UserSubscriptionProps,
    id?: Uuid
  ) {
    this.id = id ?? Uuid.create();
  }

  static create(
    props: Omit<UserSubscriptionProps, 'createdAt' | 'updatedAt'> & {
      createdAt?: Date;
      updatedAt?: Date;
    },
    id?: Uuid
  ): UserSubscription {
    const now = new Date();

    return new UserSubscription(
      {
        ...props,
        createdAt: props.createdAt ?? now,
        updatedAt: props.updatedAt ?? now
      },
      id
    );
  }

  static reconstitute(props: UserSubscriptionProps, id: Uuid): UserSubscription {
    return new UserSubscription(props, id);
  }

  sync(
    input: Partial<
      Pick<
        UserSubscriptionProps,
        | 'provider'
        | 'providerCustomerId'
        | 'providerSubscriptionId'
        | 'providerPriceId'
        | 'plan'
        | 'billingInterval'
        | 'currency'
        | 'status'
        | 'currentPeriodStart'
        | 'currentPeriodEnd'
        | 'cancelAtPeriodEnd'
        | 'cancelAt'
        | 'canceledAt'
        | 'latestInvoiceId'
      >
    >,
    date = new Date()
  ): void {
    Object.assign(this.props, input);
    this.props.updatedAt = date;
  }

  get userId(): string {
    return this.props.userId;
  }

  get provider(): PaymentProviderType {
    return this.props.provider;
  }

  get providerCustomerId(): string | undefined {
    return this.props.providerCustomerId;
  }

  get providerSubscriptionId(): string | undefined {
    return this.props.providerSubscriptionId;
  }

  get providerPriceId(): string | undefined {
    return this.props.providerPriceId;
  }

  get stripeCustomerId(): string {
    return this.props.providerCustomerId ?? '';
  }

  get stripeSubscriptionId(): string {
    return this.props.providerSubscriptionId ?? '';
  }

  get stripePriceId(): string {
    return this.props.providerPriceId ?? '';
  }

  get plan(): PlanType {
    return this.props.plan;
  }

  get billingInterval(): BillingInterval {
    return this.props.billingInterval;
  }

  get currency(): BillingCurrency {
    return this.props.currency;
  }

  get status(): SubscriptionStatus {
    return this.props.status;
  }

  get currentPeriodStart(): Date | undefined {
    return this.props.currentPeriodStart;
  }

  get currentPeriodEnd(): Date | undefined {
    return this.props.currentPeriodEnd;
  }

  get cancelAtPeriodEnd(): boolean {
    return this.props.cancelAtPeriodEnd;
  }

  get cancelAt(): Date | undefined {
    return this.props.cancelAt;
  }

  get canceledAt(): Date | undefined {
    return this.props.canceledAt;
  }

  get latestInvoiceId(): string | undefined {
    return this.props.latestInvoiceId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toJson() {
    return {
      id: this.id.value,
      userId: this.userId,
      provider: this.provider,
      providerCustomerId: this.providerCustomerId,
      providerSubscriptionId: this.providerSubscriptionId,
      providerPriceId: this.providerPriceId,
      stripeCustomerId: this.stripeCustomerId,
      stripeSubscriptionId: this.stripeSubscriptionId,
      stripePriceId: this.stripePriceId,
      plan: this.plan,
      billingInterval: this.billingInterval,
      currency: this.currency,
      status: this.status,
      currentPeriodStart: this.currentPeriodStart?.toISOString(),
      currentPeriodEnd: this.currentPeriodEnd?.toISOString(),
      cancelAtPeriodEnd: this.cancelAtPeriodEnd,
      cancelAt: this.cancelAt?.toISOString(),
      canceledAt: this.canceledAt?.toISOString(),
      latestInvoiceId: this.latestInvoiceId,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }
}
