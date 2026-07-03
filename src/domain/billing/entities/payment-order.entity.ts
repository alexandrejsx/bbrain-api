import {
  BillingCurrency,
  BillingInterval,
  PaymentMethodType,
  PaymentProviderType,
  PaymentStatus,
  PlanType
} from '../../plans/plan-definition';
import { Entity } from '../../core/entity';
import { Uuid } from '../../shared/uuid.vo';

export interface PaymentOrderProps {
  userId: string;
  provider: PaymentProviderType;
  providerPaymentId?: string;
  plan: PlanType;
  billingInterval: BillingInterval;
  currency: BillingCurrency;
  amountCents: number;
  status: PaymentStatus;
  paymentMethod: PaymentMethodType;
  accessDays: number;
  isPlanChange: boolean;
  previousPlan?: PlanType;
  creditAmountCents: number;
  amountToPayCents: number;
  expiresAt?: Date;
  paidAt?: Date;
  checkoutUrl?: string;
  qrCodeImage?: string;
  qrCodeText?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PaymentOrder extends Entity<PaymentOrderProps> {
  private constructor(
    private readonly props: PaymentOrderProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(
    props: Omit<PaymentOrderProps, 'createdAt' | 'updatedAt'> & {
      createdAt?: Date;
      updatedAt?: Date;
    },
    id?: Uuid
  ): PaymentOrder {
    const now = new Date();

    return new PaymentOrder(
      {
        ...props,
        createdAt: props.createdAt ?? now,
        updatedAt: props.updatedAt ?? now
      },
      id
    );
  }

  static reconstitute(props: PaymentOrderProps, id: Uuid): PaymentOrder {
    return new PaymentOrder(props, id);
  }

  sync(input: Partial<Omit<PaymentOrderProps, 'userId' | 'createdAt'>>, date = new Date()): void {
    Object.assign(this.props, input);
    this.props.updatedAt = date;
  }

  markPaid(input: { paidAt: Date }, date = new Date()): void {
    this.props.status = PaymentStatus.PAID;
    this.props.paidAt = input.paidAt;
    this.props.updatedAt = date;
  }

  markExpired(date = new Date()): void {
    this.props.status = PaymentStatus.EXPIRED;
    this.props.updatedAt = date;
  }

  markCanceled(date = new Date()): void {
    this.props.status = PaymentStatus.CANCELED;
    this.props.updatedAt = date;
  }

  markFailed(date = new Date()): void {
    this.props.status = PaymentStatus.FAILED;
    this.props.updatedAt = date;
  }

  get userId(): string {
    return this.props.userId;
  }

  get provider(): PaymentProviderType {
    return this.props.provider;
  }

  get providerPaymentId(): string | undefined {
    return this.props.providerPaymentId;
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

  get amountCents(): number {
    return this.props.amountCents;
  }

  get status(): PaymentStatus {
    return this.props.status;
  }

  get paymentMethod(): PaymentMethodType {
    return this.props.paymentMethod;
  }

  get accessDays(): number {
    return this.props.accessDays;
  }

  get isPlanChange(): boolean {
    return this.props.isPlanChange;
  }

  get previousPlan(): PlanType | undefined {
    return this.props.previousPlan;
  }

  get creditAmountCents(): number {
    return this.props.creditAmountCents;
  }

  get amountToPayCents(): number {
    return this.props.amountToPayCents;
  }

  get checkoutUrl(): string | undefined {
    return this.props.checkoutUrl;
  }

  get qrCodeImage(): string | undefined {
    return this.props.qrCodeImage;
  }

  get qrCodeText(): string | undefined {
    return this.props.qrCodeText;
  }

  get expiresAt(): Date | undefined {
    return this.props.expiresAt;
  }

  get paidAt(): Date | undefined {
    return this.props.paidAt;
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
      provider: this.provider,
      providerPaymentId: this.providerPaymentId,
      plan: this.plan,
      billingInterval: this.billingInterval,
      currency: this.currency,
      amountCents: this.amountCents,
      status: this.status,
      paymentMethod: this.paymentMethod,
      accessDays: this.accessDays,
      isPlanChange: this.isPlanChange,
      previousPlan: this.previousPlan,
      creditAmountCents: this.creditAmountCents,
      amountToPayCents: this.amountToPayCents,
      checkoutUrl: this.checkoutUrl,
      qrCodeImage: this.qrCodeImage,
      qrCodeText: this.qrCodeText,
      expiresAt: this.expiresAt?.toISOString(),
      paidAt: this.paidAt?.toISOString(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }
}
