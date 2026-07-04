import { PaymentOrder } from '../../billing/entities/payment-order.entity';
import { ProviderEvent } from '../../billing/entities/provider-event.entity';
import { UserSubscription } from '../../billing/entities/user-subscription.entity';
import { PaymentOrderRepository } from '../../billing/repositories/payment-order.repository';
import { ProviderEventRepository } from '../../billing/repositories/provider-event.repository';
import { UserSubscriptionRepository } from '../../billing/repositories/user-subscription.repository';
import {
  BillingCurrency,
  BillingInterval,
  PaymentMethodType,
  PaymentProviderType,
  PaymentStatus,
  PlanType,
  SubscriptionStatus
} from '../../plans/plan-definition';
import { User } from '../../users/entities/user.entity';
import type { UserProfileSnapshot } from '../../users/entities/user-profile.types';
import { UserRepository } from '../../users/repositories/user.repository';
import { Email } from '../../users/value-objects/email.vo';
import { UserName } from '../../users/value-objects/user-name.vo';
import { BillingService } from '../../../use-cases/billing/billing.service';
import { PlanChangeCalculatorService } from '../../../use-cases/billing/plan-change-calculator.service';
import { PlansService } from '../../../use-cases/plans/plans.service';

class InMemoryUserRepository implements UserRepository {
  readonly users = new Map<string, User>();

  add(user: User) {
    this.users.set(user.id.value, user);
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  findByEmail(): Promise<User | null> {
    return Promise.resolve(null);
  }

  findScheduledForDeletionDueBefore(): Promise<User[]> {
    return Promise.resolve([]);
  }

  save(user: User): Promise<void> {
    this.users.set(user.id.value, user);
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    this.users.delete(id);
    return Promise.resolve();
  }
}

class InMemorySubscriptionRepository implements UserSubscriptionRepository {
  readonly subscriptions = new Map<string, UserSubscription>();

  findByProviderSubscriptionId(
    provider: PaymentProviderType,
    providerSubscriptionId: string
  ): Promise<UserSubscription | null> {
    return Promise.resolve(
      [...this.subscriptions.values()].find(
        (subscription) =>
          subscription.provider === provider &&
          subscription.providerSubscriptionId === providerSubscriptionId
      ) ?? null
    );
  }

  findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<UserSubscription | null> {
    return this.findByProviderSubscriptionId(PaymentProviderType.STRIPE, stripeSubscriptionId);
  }

  findLatestByUserId(userId: string): Promise<UserSubscription | null> {
    return Promise.resolve(
      [...this.subscriptions.values()]
        .filter((subscription) => subscription.userId === userId)
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0] ?? null
    );
  }

  save(subscription: UserSubscription): Promise<void> {
    this.subscriptions.set(subscription.id.value, subscription);
    return Promise.resolve();
  }
}

class InMemoryPaymentOrderRepository implements PaymentOrderRepository {
  readonly orders = new Map<string, PaymentOrder>();

  findById(id: string): Promise<PaymentOrder | null> {
    return Promise.resolve(this.orders.get(id) ?? null);
  }

  findByProviderPaymentId(
    provider: PaymentProviderType,
    providerPaymentId: string
  ): Promise<PaymentOrder | null> {
    return Promise.resolve(
      [...this.orders.values()].find(
        (order) => order.provider === provider && order.providerPaymentId === providerPaymentId
      ) ?? null
    );
  }

  findLatestByUserIdAndStatus(userId: string, status: PaymentStatus): Promise<PaymentOrder | null> {
    return Promise.resolve(
      [...this.orders.values()]
        .filter((order) => order.userId === userId && order.status === status)
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0] ?? null
    );
  }

  save(order: PaymentOrder): Promise<void> {
    this.orders.set(order.id.value, order);
    return Promise.resolve();
  }
}

class InMemoryProviderEventRepository implements ProviderEventRepository {
  readonly events = new Map<string, ProviderEvent>();

  findByProviderEventId(
    provider: PaymentProviderType,
    providerEventId: string
  ): Promise<ProviderEvent | null> {
    return Promise.resolve(this.events.get(`${provider}:${providerEventId}`) ?? null);
  }

  save(event: ProviderEvent): Promise<void> {
    this.events.set(`${event.provider}:${event.providerEventId}`, event);
    return Promise.resolve();
  }
}

function createUser(nationality = 'BR') {
  const user = User.register({
    name: new UserName('Usuário'),
    email: new Email('usuario-billing@bbrain.com'),
    passwordHash: 'hashed-password',
    acceptedTermsAt: new Date('2026-01-01T00:00:00.000Z')
  });

  if (nationality) {
    user.updateProfile(createProfileSnapshot(nationality), new Date('2026-01-01T00:00:00.000Z'));
  }

  return user;
}

function createProfileSnapshot(nationality: string): UserProfileSnapshot {
  return {
    profileCompleted: true,
    basicInfo: {
      nationality,
      language: 'pt-BR'
    },
    goals: {
      mainGoals: []
    },
    conversationPreferences: {},
    professionalContext: {},
    privacySettings: {
      allowPersonalization: true,
      allowMemory: true,
      allowMoodInsights: true,
      allowSensitiveDataStorage: true
    }
  };
}

function createService() {
  const userRepository = new InMemoryUserRepository();
  const subscriptionRepository = new InMemorySubscriptionRepository();
  const paymentOrderRepository = new InMemoryPaymentOrderRepository();
  const providerEventRepository = new InMemoryProviderEventRepository();
  const stripeProvider = {
    createCustomer: jest.fn().mockResolvedValue('cus_test'),
    createCheckoutSession: jest.fn().mockResolvedValue({ url: 'https://stripe.test/checkout' }),
    createPortalSession: jest.fn().mockResolvedValue({ url: 'https://stripe.test/portal' }),
    constructWebhookEvent: jest.fn(),
    retrieveSubscription: jest.fn()
  };
  const asaasProvider = {
    createPixCharge: jest.fn().mockImplementation(({ order }) =>
      Promise.resolve({
        customerId: 'cus_asaas_test',
        providerPaymentId: `asaas-${order.id.value}`,
        qrCodeImage: 'data:image/png;base64,qr',
        qrCodeText: 'pix-copy-paste',
        expiresAt: order.expiresAt
      })
    ),
    parseWebhook: jest.fn()
  };
  const usageService = {
    getUsageSummary: jest.fn().mockResolvedValue({
      plan: PlanType.FREE,
      planName: 'Free',
      dateKey: '2026-01-01T00',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      dailyTokenLimit: 30_000,
      messageCount: 0,
      dailyMessageLimit: 20,
      tokenUsagePercentage: 0,
      messageUsagePercentage: 0,
      remainingTokens: 30_000,
      remainingMessages: 20,
      periodEnd: '2026-01-02T00:00:00.000Z'
    })
  };
  const service = new BillingService(
    userRepository,
    subscriptionRepository,
    paymentOrderRepository,
    providerEventRepository,
    new PlansService(),
    new PlanChangeCalculatorService(),
    usageService as never,
    stripeProvider,
    asaasProvider
  );

  return {
    service,
    userRepository,
    subscriptionRepository,
    paymentOrderRepository,
    providerEventRepository,
    stripeProvider,
    asaasProvider
  };
}

function createAsaasSubscription(
  userId: string,
  overrides?: Partial<Parameters<typeof UserSubscription.create>[0]>
) {
  return UserSubscription.create({
    userId,
    provider: PaymentProviderType.ASAAS,
    providerSubscriptionId: 'asaas-subscription',
    plan: PlanType.STANDARD,
    billingInterval: BillingInterval.MONTHLY,
    currency: BillingCurrency.BRL,
    status: SubscriptionStatus.ACTIVE,
    currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-01-31T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    ...overrides
  });
}

function createStripeSubscription(
  userId: string,
  overrides?: Partial<Parameters<typeof UserSubscription.create>[0]>
) {
  return UserSubscription.create({
    userId,
    provider: PaymentProviderType.STRIPE,
    providerCustomerId: 'cus_test',
    providerSubscriptionId: 'sub_test',
    providerPriceId: 'price_test',
    plan: PlanType.STANDARD,
    billingInterval: BillingInterval.MONTHLY,
    currency: BillingCurrency.BRL,
    status: SubscriptionStatus.ACTIVE,
    currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-01-31T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    ...overrides
  });
}

describe('BillingService', () => {
  it('resolves BRL for Brazilian accounts independently of language', () => {
    const service = new PlansService();
    const user = createUser('BR');
    user.updateProfile(
      {
        ...createProfileSnapshot('BR'),
        basicInfo: {
          nationality: 'BR',
          language: 'en-US'
        }
      },
      new Date('2026-01-01T00:00:00.000Z')
    );

    expect(service.resolveBillingCurrency(user)).toBe(BillingCurrency.BRL);
  });

  it('resolves USD for non-Brazilian accounts even when the language is pt-BR', () => {
    const service = new PlansService();
    const user = createUser('US');

    expect(service.resolveBillingCurrency(user)).toBe(BillingCurrency.USD);
  });

  it('defaults to USD when the account country is missing', () => {
    const service = new PlansService();
    const user = createUser('');

    expect(service.resolveBillingCurrency(user)).toBe(BillingCurrency.USD);
  });

  it('creates Stripe checkout without activating the paid plan', async () => {
    const { service, userRepository, stripeProvider } = createService();
    const user = createUser();
    userRepository.add(user);
    const previous = process.env.STRIPE_PRICE_STANDARD_MONTHLY_BRL;
    process.env.STRIPE_PRICE_STANDARD_MONTHLY_BRL = 'price_standard_monthly_brl';

    const checkout = await service.createCheckoutSession({
      userId: user.id.value,
      plan: PlanType.STANDARD,
      billingInterval: BillingInterval.MONTHLY,
      paymentMethod: PaymentMethodType.CARD
    });

    expect(checkout).toMatchObject({ provider: PaymentProviderType.STRIPE, type: 'redirect' });
    expect(stripeProvider.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ priceId: 'price_standard_monthly_brl' })
    );
    expect((await userRepository.findById(user.id.value))?.plan).toBe(PlanType.FREE);

    if (previous === undefined) {
      delete process.env.STRIPE_PRICE_STANDARD_MONTHLY_BRL;
    } else {
      process.env.STRIPE_PRICE_STANDARD_MONTHLY_BRL = previous;
    }
  });

  it('ignores an incorrect frontend currency and uses BRL for Brazilian Stripe checkout', async () => {
    const { service, userRepository, stripeProvider } = createService();
    const user = createUser('BR');
    userRepository.add(user);
    const previous = process.env.STRIPE_PRICE_STANDARD_MONTHLY_BRL;
    process.env.STRIPE_PRICE_STANDARD_MONTHLY_BRL = 'price_standard_monthly_brl';

    const checkout = await service.createCheckoutSession({
      userId: user.id.value,
      plan: PlanType.STANDARD,
      billingInterval: BillingInterval.MONTHLY,
      requestedCurrency: BillingCurrency.USD,
      paymentMethod: PaymentMethodType.CARD
    });

    expect(checkout).toMatchObject({ provider: PaymentProviderType.STRIPE, type: 'redirect' });
    expect(stripeProvider.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ priceId: 'price_standard_monthly_brl' })
    );

    if (previous === undefined) {
      delete process.env.STRIPE_PRICE_STANDARD_MONTHLY_BRL;
    } else {
      process.env.STRIPE_PRICE_STANDARD_MONTHLY_BRL = previous;
    }
  });

  it('uses USD for non-Brazilian Stripe checkout', async () => {
    const { service, userRepository, stripeProvider } = createService();
    const user = createUser('US');
    userRepository.add(user);
    const previous = process.env.STRIPE_PRICE_STANDARD_MONTHLY_USD;
    process.env.STRIPE_PRICE_STANDARD_MONTHLY_USD = 'price_standard_monthly_usd';

    const checkout = await service.createCheckoutSession({
      userId: user.id.value,
      plan: PlanType.STANDARD,
      billingInterval: BillingInterval.MONTHLY,
      paymentMethod: PaymentMethodType.CARD
    });

    expect(checkout).toMatchObject({ provider: PaymentProviderType.STRIPE, type: 'redirect' });
    expect(stripeProvider.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ priceId: 'price_standard_monthly_usd' })
    );

    if (previous === undefined) {
      delete process.env.STRIPE_PRICE_STANDARD_MONTHLY_USD;
    } else {
      process.env.STRIPE_PRICE_STANDARD_MONTHLY_USD = previous;
    }
  });

  it('rejects Stripe webhook requests with invalid signatures', async () => {
    const { service, stripeProvider } = createService();
    stripeProvider.constructWebhookEvent.mockImplementation(() => {
      throw new Error('invalid');
    });

    await expect(service.handleStripeWebhook(Buffer.from('{}'), 't=1,v1=invalid')).rejects.toThrow(
      'Invalid Stripe signature'
    );
  });

  it('ignores Stripe events outside the allowlist', async () => {
    const { service, providerEventRepository, stripeProvider } = createService();
    const processStripeEventSpy = jest
      .spyOn(service as any, 'processStripeEvent')
      .mockImplementation(() => Promise.resolve(undefined));

    stripeProvider.constructWebhookEvent.mockReturnValue({
      id: 'evt_unrelated',
      type: 'payment_intent.created'
    });

    await expect(service.handleStripeWebhook(Buffer.from('{}'), 't=1,v1=valid')).resolves.toEqual({
      received: true
    });

    expect(processStripeEventSpy).not.toHaveBeenCalled();
    expect(providerEventRepository.events.size).toBe(0);
  });

  it('processes a Stripe event only once per event id', async () => {
    const { service, providerEventRepository, stripeProvider } = createService();
    const processStripeEventSpy = jest
      .spyOn(service as any, 'processStripeEvent')
      .mockImplementation(() => Promise.resolve(undefined));

    stripeProvider.constructWebhookEvent.mockReturnValue({
      id: 'evt_allowed',
      type: 'invoice.paid'
    });

    await expect(service.handleStripeWebhook(Buffer.from('{}'), 't=1,v1=valid')).resolves.toEqual({
      received: true
    });
    await expect(service.handleStripeWebhook(Buffer.from('{}'), 't=1,v1=valid')).resolves.toEqual({
      received: true
    });

    expect(processStripeEventSpy).toHaveBeenCalledTimes(1);
    expect(providerEventRepository.events.size).toBe(1);
  });

  it('rejects Pix checkout in USD', async () => {
    const { service, userRepository } = createService();
    const user = createUser('US');
    userRepository.add(user);

    await expect(
      service.createCheckoutSession({
        userId: user.id.value,
        plan: PlanType.PRO,
        billingInterval: BillingInterval.YEARLY,
        paymentMethod: PaymentMethodType.PIX
      })
    ).rejects.toThrow('Pix está disponível apenas para contas do Brasil.');
  });

  it('creates a Asaas payment order with the configured plan amount', async () => {
    const { service, userRepository, paymentOrderRepository } = createService();
    const user = createUser();
    userRepository.add(user);

    const checkout = await service.createCheckoutSession({
      userId: user.id.value,
      plan: PlanType.PRO,
      billingInterval: BillingInterval.MONTHLY,
      paymentMethod: PaymentMethodType.PIX
    });
    const order = await paymentOrderRepository.findById(checkout.paymentId ?? '');

    expect(checkout).toMatchObject({ provider: PaymentProviderType.ASAAS, type: 'pix' });
    expect(order?.amountCents).toBe(4_990);
    expect(order?.amountToPayCents).toBe(4_990);
    expect(order?.status).toBe(PaymentStatus.PENDING);
  });

  it('creates a Pix upgrade charging only the proportional difference', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-16T00:00:00.000Z'));

    try {
      const {
        service,
        userRepository,
        subscriptionRepository,
        paymentOrderRepository,
        asaasProvider
      } = createService();
      const user = createUser();
      user.activatePaidPlan(
        {
          plan: PlanType.STANDARD,
          billingProvider: PaymentProviderType.ASAAS,
          billingStatus: SubscriptionStatus.ACTIVE,
          planAccessUntil: new Date('2026-01-31T00:00:00.000Z')
        },
        new Date('2026-01-01T00:00:00.000Z')
      );
      userRepository.add(user);

      const subscription = createAsaasSubscription(user.id.value);
      await subscriptionRepository.save(subscription);

      const checkout = await service.createCheckoutSession({
        userId: user.id.value,
        plan: PlanType.PRO,
        billingInterval: BillingInterval.MONTHLY,
        paymentMethod: PaymentMethodType.PIX
      });
      const order = await paymentOrderRepository.findById(checkout.paymentId ?? '');

      expect(checkout).toMatchObject({ provider: PaymentProviderType.ASAAS, type: 'pix' });
      expect(order?.previousPlan).toBe(PlanType.STANDARD);
      expect(order?.isPlanChange).toBe(true);
      expect(order?.amountCents).toBe(4_990);
      expect(order?.creditAmountCents).toBe(995);
      expect(order?.amountToPayCents).toBe(3_995);
      expect(asaasProvider.createPixCharge).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 3_995
        })
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('blocks Pix downgrade and keeps the current paid period', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-16T00:00:00.000Z'));

    try {
      const { service, userRepository, subscriptionRepository } = createService();
      const user = createUser();
      user.activatePaidPlan(
        {
          plan: PlanType.PRO,
          billingProvider: PaymentProviderType.ASAAS,
          billingStatus: SubscriptionStatus.ACTIVE,
          planAccessUntil: new Date('2026-01-31T00:00:00.000Z')
        },
        new Date('2026-01-01T00:00:00.000Z')
      );
      userRepository.add(user);
      await subscriptionRepository.save(
        createAsaasSubscription(user.id.value, {
          plan: PlanType.PRO
        })
      );

      await expect(
        service.createCheckoutSession({
          userId: user.id.value,
          plan: PlanType.STANDARD,
          billingInterval: BillingInterval.MONTHLY,
          paymentMethod: PaymentMethodType.PIX
        })
      ).rejects.toThrow(
        'Seu plano atual continuará ativo até o fim do período pago. Para mudar para um plano inferior, aguarde o fim do ciclo atual.'
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('only opens the Stripe portal for users whose latest subscription is Stripe', async () => {
    const { service, userRepository, subscriptionRepository, stripeProvider } = createService();
    const stripeUser = createUser();
    stripeUser.updateStripeCustomerId('cus_test');
    userRepository.add(stripeUser);
    await subscriptionRepository.save(createStripeSubscription(stripeUser.id.value));

    await expect(service.createCustomerPortalSession(stripeUser.id.value)).resolves.toEqual({
      url: 'https://stripe.test/portal'
    });

    const asaasUser = createUser();
    asaasUser.updateStripeCustomerId('cus_old');
    asaasUser.activatePaidPlan({
      plan: PlanType.STANDARD,
      billingProvider: PaymentProviderType.ASAAS,
      billingStatus: SubscriptionStatus.ACTIVE,
      planAccessUntil: new Date('2026-01-31T00:00:00.000Z')
    });
    userRepository.add(asaasUser);
    await subscriptionRepository.save(createAsaasSubscription(asaasUser.id.value));

    await expect(service.createCustomerPortalSession(asaasUser.id.value)).rejects.toThrow(
      'Nenhuma assinatura Stripe encontrada para gerenciar.'
    );
    expect(stripeProvider.createPortalSession).toHaveBeenCalledTimes(1);
  });

  it('activates Asaas access after a paid webhook and ignores duplicates', async () => {
    const { service, userRepository, providerEventRepository, asaasProvider } = createService();
    const user = createUser();
    userRepository.add(user);
    const checkout = await service.createCheckoutSession({
      userId: user.id.value,
      plan: PlanType.STANDARD,
      billingInterval: BillingInterval.MONTHLY,
      paymentMethod: PaymentMethodType.PIX
    });

    asaasProvider.parseWebhook.mockReturnValue({
      providerEventId: 'evt_asaas_paid',
      type: 'PAYMENT_RECEIVED',
      correlationId: checkout.paymentId,
      paid: true,
      expired: false,
      canceled: false,
      failed: false
    });

    await service.handleAsaasWebhook(Buffer.from('{}'), {});
    await service.handleAsaasWebhook(Buffer.from('{}'), {});

    const updatedUser = await userRepository.findById(user.id.value);

    expect(updatedUser?.plan).toBe(PlanType.STANDARD);
    expect(updatedUser?.billingProvider).toBe(PaymentProviderType.ASAAS);
    expect(updatedUser?.billingStatus).toBe(SubscriptionStatus.ACTIVE);
    expect(updatedUser?.planAccessUntil).toBeDefined();
    expect(providerEventRepository.events.size).toBe(1);
  });

  it('does not expire a Asaas payment order after it was already paid', async () => {
    const { service, userRepository, paymentOrderRepository, asaasProvider } = createService();
    const user = createUser();
    userRepository.add(user);
    const checkout = await service.createCheckoutSession({
      userId: user.id.value,
      plan: PlanType.STANDARD,
      billingInterval: BillingInterval.MONTHLY,
      paymentMethod: PaymentMethodType.PIX
    });

    asaasProvider.parseWebhook.mockReturnValueOnce({
      providerEventId: 'evt_asaas_paid',
      type: 'PAYMENT_RECEIVED',
      correlationId: checkout.paymentId,
      paid: true,
      expired: false,
      canceled: false,
      failed: false
    });
    await service.handleAsaasWebhook(Buffer.from('{}'), {});

    asaasProvider.parseWebhook.mockReturnValueOnce({
      providerEventId: 'evt_asaas_expired',
      type: 'PAYMENT_OVERDUE',
      correlationId: checkout.paymentId,
      paid: false,
      expired: true,
      canceled: false,
      failed: false
    });
    await service.handleAsaasWebhook(Buffer.from('{}'), {});

    const order = await paymentOrderRepository.findById(checkout.paymentId ?? '');

    expect(order?.status).toBe(PaymentStatus.PAID);
  });
});
