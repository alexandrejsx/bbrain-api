import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { User } from '../../../domain/users/entities/user.entity';
import {
  StripeCheckoutInput,
  StripePaymentPort,
  StripeSubscriptionSnapshot,
  StripeWebhookEvent,
  StripeWebhookEventData
} from '../../../use-cases/billing/ports/payment-provider.port';

export class StripePaymentProvider implements StripePaymentPort {
  private readonly stripe: Stripe | null;

  constructor(private readonly config: ConfigService) {
    const secretKey = this.config.get<string>('billing.stripeSecretKey');
    this.stripe = secretKey ? new Stripe(secretKey) : null;
  }

  async createCustomer(user: User): Promise<string> {
    const customer = await this.getStripe().customers.create({
      email: user.email.value,
      name: user.name.value,
      metadata: {
        userId: user.id.value
      }
    });

    return customer.id;
  }

  async createCheckoutSession(input: StripeCheckoutInput): Promise<{ url: string }> {
    const session = await this.getStripe().checkout.sessions.create({
      mode: 'subscription',
      customer: input.customerId,
      line_items: [{ price: input.priceId, quantity: 1 }],
      success_url: this.config.get<string>('billing.checkoutSuccessUrl'),
      cancel_url: this.config.get<string>('billing.checkoutCancelUrl'),
      allow_promotion_codes: true,
      metadata: input.metadata,
      subscription_data: {
        metadata: input.metadata
      }
      // Stripe Dashboard controls card, Apple Pay, Google Pay and Link availability.
    });

    if (!session.url) {
      throw new ServiceUnavailableException('Não foi possível iniciar o checkout agora.');
    }

    return { url: session.url };
  }

  async createPortalSession(customerId: string): Promise<{ url: string }> {
    const session = await this.getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: this.config.get<string>('billing.stripePortalReturnUrl')
    });

    return { url: session.url };
  }

  constructWebhookEvent(rawBody: Buffer, stripeSignature: string): StripeWebhookEvent {
    const webhookSecret = this.config.get<string>('billing.stripeWebhookSecret');

    if (!webhookSecret) {
      throw new ServiceUnavailableException('Stripe webhook is not configured');
    }

    const event = this.getStripe().webhooks.constructEvent(rawBody, stripeSignature, webhookSecret);

    return {
      id: event.id,
      type: event.type,
      data: mapStripeWebhookData(event)
    };
  }

  async retrieveSubscription(subscriptionId: string): Promise<StripeSubscriptionSnapshot> {
    return mapStripeSubscription(await this.getStripe().subscriptions.retrieve(subscriptionId));
  }

  private getStripe(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException('Stripe não está configurado.');
    }

    return this.stripe;
  }
}

function mapStripeWebhookData(event: Stripe.Event): StripeWebhookEventData {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;

      return {
        kind: 'checkout.session.completed',
        subscriptionId: getStripeId(session.subscription),
        metadata: toMetadataRecord(session.metadata)
      };
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return {
        kind: 'subscription',
        subscription: mapStripeSubscription(event.data.object)
      };
    case 'invoice.paid':
    case 'invoice.payment_failed':
      return {
        kind: 'invoice',
        subscriptionId: getStripeId(readValue(event.data.object, 'subscription'))
      };
    default:
      return { kind: 'unknown' };
  }
}

function mapStripeSubscription(subscription: Stripe.Subscription): StripeSubscriptionSnapshot {
  return {
    id: subscription.id,
    status: subscription.status,
    customerId: getStripeId(subscription.customer),
    priceId: subscription.items.data[0]?.price?.id,
    metadata: toMetadataRecord(subscription.metadata),
    currentPeriodStart: toDate(readNumber(subscription, 'current_period_start')),
    currentPeriodEnd: toDate(readNumber(subscription, 'current_period_end')),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    cancelAt: toDate(subscription.cancel_at),
    canceledAt: toDate(subscription.canceled_at),
    latestInvoiceId: getStripeId(readValue(subscription, 'latest_invoice'))
  };
}

function toMetadataRecord(metadata?: Stripe.Metadata | null): Record<string, string> {
  return metadata ? { ...metadata } : {};
}

function getStripeId(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id;
  }

  return undefined;
}

function readNumber(value: object, key: string): number | undefined {
  const item = readValue(value, key);
  return typeof item === 'number' ? item : undefined;
}

function readValue(value: object, key: string): unknown {
  return (value as Record<string, unknown>)[key];
}

function toDate(timestamp?: number | null): Date | undefined {
  return typeof timestamp === 'number' ? new Date(timestamp * 1000) : undefined;
}
