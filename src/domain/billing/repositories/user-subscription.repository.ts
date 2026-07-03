import { UserSubscription } from '../entities/user-subscription.entity';
import { PaymentProviderType } from '../../plans/plan-definition';

export interface UserSubscriptionRepository {
  findByProviderSubscriptionId(
    provider: PaymentProviderType,
    providerSubscriptionId: string
  ): Promise<UserSubscription | null>;
  findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<UserSubscription | null>;
  findLatestByUserId(userId: string): Promise<UserSubscription | null>;
  save(subscription: UserSubscription): Promise<void>;
}
