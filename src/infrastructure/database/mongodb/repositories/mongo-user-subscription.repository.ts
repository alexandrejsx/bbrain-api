import { Injectable } from '@nestjs/common';
import { UserSubscription } from '../../../../domain/billing/entities/user-subscription.entity';
import { UserSubscriptionRepository } from '../../../../domain/billing/repositories/user-subscription.repository';
import { PaymentProviderType } from '../../../../domain/plans/plan-definition';
import { MongoUserSubscriptionMapper } from '../mappers/user-subscription.mapper';
import { MongodbRepository } from '../mongodb.repository';
import { UserSubscriptionDocument } from '../schemas/user-subscription.schema';

@Injectable()
export class MongoUserSubscriptionRepository implements UserSubscriptionRepository {
  constructor(private readonly baseRepository: MongodbRepository<UserSubscriptionDocument>) {}

  async findByProviderSubscriptionId(
    provider: PaymentProviderType,
    providerSubscriptionId: string
  ): Promise<UserSubscription | null> {
    const doc = await this.baseRepository.findOne({
      provider,
      provider_subscription_id: providerSubscriptionId
    });

    return doc ? MongoUserSubscriptionMapper.toDomain(doc) : null;
  }

  async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<UserSubscription | null> {
    const subscription = await this.findByProviderSubscriptionId(
      PaymentProviderType.STRIPE,
      stripeSubscriptionId
    );

    if (subscription) {
      return subscription;
    }

    const doc = await this.baseRepository.findOne({
      stripe_subscription_id: stripeSubscriptionId
    });

    return doc ? MongoUserSubscriptionMapper.toDomain(doc) : null;
  }

  async findLatestByUserId(userId: string): Promise<UserSubscription | null> {
    const [doc] = await this.baseRepository.findAll({ user_id: userId }, { updated_at: -1 }, 1);

    return doc ? MongoUserSubscriptionMapper.toDomain(doc) : null;
  }

  async save(subscription: UserSubscription): Promise<void> {
    const persistence = MongoUserSubscriptionMapper.toPersistence(subscription);

    if (!persistence._id) {
      throw new Error('Cannot persist user subscription without id');
    }

    const exists = await this.baseRepository.findOne(persistence._id);

    if (exists) {
      await this.baseRepository.update(exists._id.toString(), persistence);
      return;
    }

    await this.baseRepository.add(persistence);
  }
}
