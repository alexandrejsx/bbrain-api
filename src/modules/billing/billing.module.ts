import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaymentOrderRepository } from '../../domain/billing/repositories/payment-order.repository';
import { ProviderEventRepository } from '../../domain/billing/repositories/provider-event.repository';
import { UserSubscriptionRepository } from '../../domain/billing/repositories/user-subscription.repository';
import { UserDailyUsageRepository } from '../../domain/usage/repositories/user-daily-usage.repository';
import { UsageService } from '../../domain/usage/services/usage.service';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import { MongoPaymentOrderRepository } from '../../infrastructure/database/mongodb/repositories/mongo-payment-order.repository';
import { MongoProviderEventRepository } from '../../infrastructure/database/mongodb/repositories/mongo-provider-event.repository';
import { MongoUserDailyUsageRepository } from '../../infrastructure/database/mongodb/repositories/mongo-user-daily-usage.repository';
import { MongoUserSubscriptionRepository } from '../../infrastructure/database/mongodb/repositories/mongo-user-subscription.repository';
import { MongodbRepository } from '../../infrastructure/database/mongodb/mongodb.repository';
import {
  PaymentOrderDocument,
  PaymentOrderMongo,
  PaymentOrderSchema
} from '../../infrastructure/database/mongodb/schemas/payment-order.schema';
import {
  ProviderEventDocument,
  ProviderEventMongo,
  ProviderEventSchema
} from '../../infrastructure/database/mongodb/schemas/provider-event.schema';
import {
  UserDailyUsageDocument,
  UserDailyUsageMongo,
  UserDailyUsageSchema
} from '../../infrastructure/database/mongodb/schemas/user-daily-usage.schema';
import {
  UserSubscriptionDocument,
  UserSubscriptionMongo,
  UserSubscriptionSchema
} from '../../infrastructure/database/mongodb/schemas/user-subscription.schema';
import { StripePaymentProvider } from '../../infrastructure/payments/stripe/stripe-payment.provider';
import { AsaasPixProvider } from '../../infrastructure/payments/asaas/asaas-pix.provider';
import { AuthModule } from '../auth/auth.module';
import {
  PAYMENT_ORDERS_BASE_REPOSITORY,
  PAYMENT_ORDERS_REPOSITORY,
  PROVIDER_EVENTS_BASE_REPOSITORY,
  PROVIDER_EVENTS_REPOSITORY,
  USER_DAILY_USAGES_BASE_REPOSITORY,
  USER_DAILY_USAGES_REPOSITORY,
  USER_SUBSCRIPTIONS_BASE_REPOSITORY,
  USER_SUBSCRIPTIONS_REPOSITORY,
  USERS_REPOSITORY
} from '../tokens';
import { UsersModule } from '../users/users.module';
import { AccountPlanService } from './account-plan.service';
import { AsaasWebhookController } from './asaas-webhook.controller';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PlanChangeCalculatorService } from './plan-change-calculator.service';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { UserPlanController } from './user-plan.controller';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    MongooseModule.forFeature([
      { name: UserDailyUsageMongo.name, schema: UserDailyUsageSchema },
      { name: UserSubscriptionMongo.name, schema: UserSubscriptionSchema },
      { name: ProviderEventMongo.name, schema: ProviderEventSchema },
      { name: PaymentOrderMongo.name, schema: PaymentOrderSchema }
    ])
  ],
  controllers: [
    PlansController,
    UserPlanController,
    BillingController,
    StripeWebhookController,
    AsaasWebhookController
  ],
  providers: [
    PlansService,
    PlanChangeCalculatorService,
    {
      provide: StripePaymentProvider,
      useFactory: (config: ConfigService) => new StripePaymentProvider(config),
      inject: [ConfigService]
    },
    {
      provide: AsaasPixProvider,
      useFactory: (config: ConfigService) => new AsaasPixProvider(config),
      inject: [ConfigService]
    },
    {
      provide: USER_DAILY_USAGES_BASE_REPOSITORY,
      useFactory: (model: Model<UserDailyUsageDocument>) =>
        new MongodbRepository<UserDailyUsageDocument>(model),
      inject: [getModelToken(UserDailyUsageMongo.name)]
    },
    {
      provide: USER_DAILY_USAGES_REPOSITORY,
      useFactory: (baseRepository: MongodbRepository<UserDailyUsageDocument>) =>
        new MongoUserDailyUsageRepository(baseRepository),
      inject: [USER_DAILY_USAGES_BASE_REPOSITORY]
    },
    {
      provide: USER_SUBSCRIPTIONS_BASE_REPOSITORY,
      useFactory: (model: Model<UserSubscriptionDocument>) =>
        new MongodbRepository<UserSubscriptionDocument>(model),
      inject: [getModelToken(UserSubscriptionMongo.name)]
    },
    {
      provide: USER_SUBSCRIPTIONS_REPOSITORY,
      useFactory: (baseRepository: MongodbRepository<UserSubscriptionDocument>) =>
        new MongoUserSubscriptionRepository(baseRepository),
      inject: [USER_SUBSCRIPTIONS_BASE_REPOSITORY]
    },
    {
      provide: PROVIDER_EVENTS_BASE_REPOSITORY,
      useFactory: (model: Model<ProviderEventDocument>) =>
        new MongodbRepository<ProviderEventDocument>(model),
      inject: [getModelToken(ProviderEventMongo.name)]
    },
    {
      provide: PROVIDER_EVENTS_REPOSITORY,
      useFactory: (baseRepository: MongodbRepository<ProviderEventDocument>) =>
        new MongoProviderEventRepository(baseRepository),
      inject: [PROVIDER_EVENTS_BASE_REPOSITORY]
    },
    {
      provide: PAYMENT_ORDERS_BASE_REPOSITORY,
      useFactory: (model: Model<PaymentOrderDocument>) =>
        new MongodbRepository<PaymentOrderDocument>(model),
      inject: [getModelToken(PaymentOrderMongo.name)]
    },
    {
      provide: PAYMENT_ORDERS_REPOSITORY,
      useFactory: (baseRepository: MongodbRepository<PaymentOrderDocument>) =>
        new MongoPaymentOrderRepository(baseRepository),
      inject: [PAYMENT_ORDERS_BASE_REPOSITORY]
    },
    {
      provide: UsageService,
      useFactory: (usageRepository: UserDailyUsageRepository, userRepository: UserRepository) =>
        new UsageService(usageRepository, userRepository),
      inject: [USER_DAILY_USAGES_REPOSITORY, USERS_REPOSITORY]
    },
    {
      provide: AccountPlanService,
      useFactory: (userRepository: UserRepository, plansService: PlansService) =>
        new AccountPlanService(userRepository, plansService),
      inject: [USERS_REPOSITORY, PlansService]
    },
    {
      provide: BillingService,
      useFactory: (
        userRepository: UserRepository,
        subscriptionRepository: UserSubscriptionRepository,
        paymentOrderRepository: PaymentOrderRepository,
        providerEventRepository: ProviderEventRepository,
        plansService: PlansService,
        planChangeCalculator: PlanChangeCalculatorService,
        usageService: UsageService,
        stripePaymentProvider: StripePaymentProvider,
        asaasPixProvider: AsaasPixProvider
      ) =>
        new BillingService(
          userRepository,
          subscriptionRepository,
          paymentOrderRepository,
          providerEventRepository,
          plansService,
          planChangeCalculator,
          usageService,
          stripePaymentProvider,
          asaasPixProvider
        ),
      inject: [
        USERS_REPOSITORY,
        USER_SUBSCRIPTIONS_REPOSITORY,
        PAYMENT_ORDERS_REPOSITORY,
        PROVIDER_EVENTS_REPOSITORY,
        PlansService,
        PlanChangeCalculatorService,
        UsageService,
        StripePaymentProvider,
        AsaasPixProvider
      ]
    }
  ],
  exports: [UsageService, AccountPlanService, PlansService, BillingService]
})
export class BillingModule {}
