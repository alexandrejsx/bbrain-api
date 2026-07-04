import { PaymentOrder } from '../../../domain/billing/entities/payment-order.entity';
import { User } from '../../../domain/users/entities/user.entity';

export interface StripeCheckoutInput {
  customerId: string;
  priceId: string;
  metadata: Record<string, string>;
}

export interface StripeSubscriptionSnapshot {
  id: string;
  status: string;
  customerId?: string;
  priceId?: string;
  metadata: Record<string, string>;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  cancelAt?: Date;
  canceledAt?: Date;
  latestInvoiceId?: string;
}

export type StripeWebhookEventData =
  | {
      kind: 'checkout.session.completed';
      subscriptionId?: string;
      metadata: Record<string, string>;
    }
  | {
      kind: 'subscription';
      subscription: StripeSubscriptionSnapshot;
    }
  | {
      kind: 'invoice';
      subscriptionId?: string;
    }
  | {
      kind: 'unknown';
    };

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: StripeWebhookEventData;
}

export interface StripePaymentPort {
  createCustomer(user: User): Promise<string>;
  createCheckoutSession(input: StripeCheckoutInput): Promise<{ url: string }>;
  createPortalSession(customerId: string): Promise<{ url: string }>;
  constructWebhookEvent(rawBody: Buffer, stripeSignature: string): StripeWebhookEvent;
  retrieveSubscription(subscriptionId: string): Promise<StripeSubscriptionSnapshot>;
}

export interface AsaasPixChargeResult {
  customerId?: string;
  providerPaymentId: string;
  checkoutUrl?: string;
  qrCodeImage?: string;
  qrCodeText?: string;
  expiresAt?: Date;
}

export interface AsaasWebhookEvent {
  providerEventId: string;
  type: string;
  providerPaymentId?: string;
  correlationId?: string;
  paid: boolean;
  expired: boolean;
  canceled: boolean;
  failed: boolean;
}

export interface AsaasPixPaymentPort {
  createPixCharge(input: {
    order: PaymentOrder;
    user: User;
    amount: number;
    expiresAt: Date;
  }): Promise<AsaasPixChargeResult>;

  parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>
  ): AsaasWebhookEvent;
}
