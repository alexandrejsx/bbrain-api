import { UserSubscription } from '../../../../domain/billing/entities/user-subscription.entity';
import {
  normalizePaymentProviderType,
  PaymentProviderType
} from '../../../../domain/plans/plan-definition';
import { Uuid } from '../../../../domain/shared/uuid.vo';
import {
  UserSubscriptionDocument,
  UserSubscriptionMongo
} from '../schemas/user-subscription.schema';

export class MongoUserSubscriptionMapper {
  static toPersistence(subscription: UserSubscription): Partial<UserSubscriptionMongo> {
    return {
      _id: subscription.id.value,
      user_id: subscription.userId,
      provider: subscription.provider,
      provider_customer_id: subscription.providerCustomerId,
      provider_subscription_id: subscription.providerSubscriptionId,
      provider_price_id: subscription.providerPriceId,
      stripe_customer_id:
        subscription.provider === PaymentProviderType.STRIPE
          ? subscription.providerCustomerId
          : undefined,
      stripe_subscription_id:
        subscription.provider === PaymentProviderType.STRIPE
          ? subscription.providerSubscriptionId
          : undefined,
      stripe_price_id:
        subscription.provider === PaymentProviderType.STRIPE
          ? subscription.providerPriceId
          : undefined,
      plan: subscription.plan,
      billing_interval: subscription.billingInterval,
      currency: subscription.currency,
      status: subscription.status,
      current_period_start: subscription.currentPeriodStart,
      current_period_end: subscription.currentPeriodEnd,
      cancel_at_period_end: subscription.cancelAtPeriodEnd,
      cancel_at: subscription.cancelAt,
      canceled_at: subscription.canceledAt,
      latest_invoice_id: subscription.latestInvoiceId,
      created_at: subscription.createdAt,
      updated_at: subscription.updatedAt
    };
  }

  static toDomain(raw: UserSubscriptionDocument | UserSubscriptionMongo): UserSubscription {
    return UserSubscription.reconstitute(
      {
        userId: raw.user_id,
        provider: normalizePaymentProviderType(raw.provider) ?? PaymentProviderType.STRIPE,
        providerCustomerId: raw.provider_customer_id ?? raw.stripe_customer_id,
        providerSubscriptionId: raw.provider_subscription_id ?? raw.stripe_subscription_id,
        providerPriceId: raw.provider_price_id ?? raw.stripe_price_id,
        plan: raw.plan,
        billingInterval: raw.billing_interval,
        currency: raw.currency,
        status: raw.status,
        currentPeriodStart: raw.current_period_start,
        currentPeriodEnd: raw.current_period_end,
        cancelAtPeriodEnd: raw.cancel_at_period_end,
        cancelAt: raw.cancel_at,
        canceledAt: raw.canceled_at,
        latestInvoiceId: raw.latest_invoice_id,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at
      },
      new Uuid(raw._id)
    );
  }
}
