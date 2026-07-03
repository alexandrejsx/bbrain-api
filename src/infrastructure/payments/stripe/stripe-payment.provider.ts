import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { User } from '../../../domain/users/entities/user.entity';

export interface StripeCheckoutInput {
  customerId: string;
  priceId: string;
  metadata: Record<string, string>;
}

export class StripePaymentProvider {
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

  constructWebhookEvent(rawBody: Buffer, stripeSignature: string): Stripe.Event {
    const webhookSecret = this.config.get<string>('billing.stripeWebhookSecret');

    if (!webhookSecret) {
      throw new ServiceUnavailableException('Stripe webhook is not configured');
    }

    return this.getStripe().webhooks.constructEvent(rawBody, stripeSignature, webhookSecret);
  }

  retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.getStripe().subscriptions.retrieve(subscriptionId);
  }

  private getStripe(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException('Stripe não está configurado.');
    }

    return this.stripe;
  }
}
