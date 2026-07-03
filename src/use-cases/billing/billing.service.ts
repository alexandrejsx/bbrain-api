import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import Stripe from 'stripe';
import { PaymentOrder } from '../../domain/billing/entities/payment-order.entity';
import { ProviderEvent } from '../../domain/billing/entities/provider-event.entity';
import { UserSubscription } from '../../domain/billing/entities/user-subscription.entity';
import { PaymentOrderRepository } from '../../domain/billing/repositories/payment-order.repository';
import { ProviderEventRepository } from '../../domain/billing/repositories/provider-event.repository';
import { UserSubscriptionRepository } from '../../domain/billing/repositories/user-subscription.repository';
import { CheckoutResult } from '../../domain/billing/payment-provider.types';
import {
  BillingCurrency,
  BillingInterval,
  PaymentMethodType,
  PaymentProviderType,
  PaymentStatus,
  PlanType,
  SubscriptionStatus
} from '../../domain/plans/plan-definition';
import { User } from '../../domain/users/entities/user.entity';
import { UserRepository } from '../../domain/users/repositories/user.repository';
import { UsageService } from '../../domain/usage/services/usage.service';
import { StripePaymentProvider } from '../../infrastructure/payments/stripe/stripe-payment.provider';
import { AsaasPixProvider } from '../../infrastructure/payments/asaas/asaas-pix.provider';
import { PlanChangeCalculatorService } from './plan-change-calculator.service';
import { PlansService } from '../plans/plans.service';

interface CreateCheckoutSessionInput {
  userId: string;
  plan: unknown;
  billingInterval: unknown;
  currency: unknown;
  paymentMethod: unknown;
}

export interface BillingSummary {
  currentPlan: PlanType;
  effectivePlan: PlanType;
  billingStatus: SubscriptionStatus;
  billingProvider?: PaymentProviderType;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  currency?: BillingCurrency;
  billingInterval?: BillingInterval;
  subscriptionStatus: SubscriptionStatus;
  planAccessUntil?: string;
  canManageBilling: boolean;
  canManageStripeBilling: boolean;
  usageSummary: Awaited<ReturnType<UsageService['getUsageSummary']>>;
  pendingPixPayment?: ReturnType<PaymentOrder['toJson']>;
}

const ACTIVE_SUBSCRIPTION_STATUSES = new Set<SubscriptionStatus>([
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING
]);
const STRIPE_WEBHOOK_EVENT_ALLOWLIST = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed'
]);

export class BillingService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly subscriptionRepository: UserSubscriptionRepository,
    private readonly paymentOrderRepository: PaymentOrderRepository,
    private readonly providerEventRepository: ProviderEventRepository,
    private readonly plansService: PlansService,
    private readonly planChangeCalculator: PlanChangeCalculatorService,
    private readonly usageService: UsageService,
    private readonly stripeProvider: StripePaymentProvider,
    private readonly asaasProvider: AsaasPixProvider
  ) {}

  async getBillingSummary(userId: string): Promise<BillingSummary> {
    const user = await this.getUser(userId);
    const subscription = await this.subscriptionRepository.findLatestByUserId(userId);
    const pendingPixPayment = await this.paymentOrderRepository.findLatestByUserIdAndStatus(
      userId,
      PaymentStatus.PENDING
    );
    const usageSummary = await this.usageService.getUsageSummary(userId);
    const effectivePlan = user.getEffectivePlan();
    const canManageStripeBilling = Boolean(
      user.stripeCustomerId && subscription?.provider === PaymentProviderType.STRIPE
    );

    return {
      currentPlan: effectivePlan,
      effectivePlan,
      billingStatus: user.billingStatus,
      billingProvider: user.billingProvider,
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString(),
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      currency: subscription?.currency,
      billingInterval: subscription?.billingInterval,
      subscriptionStatus: subscription?.status ?? SubscriptionStatus.NONE,
      planAccessUntil: user.planAccessUntil?.toISOString(),
      canManageBilling: canManageStripeBilling,
      canManageStripeBilling,
      usageSummary,
      pendingPixPayment: pendingPixPayment?.toJson()
    };
  }

  async getPaymentOrder(userId: string, paymentId: string) {
    const order = await this.paymentOrderRepository.findById(paymentId);

    if (!order || order.userId !== userId) {
      throw new NotFoundException('Pagamento não encontrado.');
    }

    if (
      order.status === PaymentStatus.PENDING &&
      order.expiresAt &&
      order.expiresAt.getTime() <= Date.now()
    ) {
      order.markExpired();
      await this.paymentOrderRepository.save(order);
    }

    return order.toJson();
  }

  async ensureStripeCustomer(user: User): Promise<string> {
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customerId = await this.stripeProvider.createCustomer(user);

    user.updateStripeCustomerId(customerId);
    await this.userRepository.save(user);

    return customerId;
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutResult> {
    const plan = this.plansService.validatePaidPlan(input.plan);
    const billingInterval = this.plansService.validateBillingInterval(input.billingInterval);
    const currency = this.plansService.validateBillingCurrency(input.currency);
    const paymentMethod = this.plansService.validatePaymentMethod(input.paymentMethod);

    if (paymentMethod === PaymentMethodType.CARD) {
      return this.createStripeCheckout({
        userId: input.userId,
        plan,
        billingInterval,
        currency
      });
    }

    return this.createAsaasPixCheckout({
      userId: input.userId,
      plan,
      billingInterval,
      currency
    });
  }

  async createCustomerPortalSession(userId: string): Promise<{ url: string }> {
    const user = await this.getUser(userId);
    const subscription = await this.subscriptionRepository.findLatestByUserId(userId);

    if (!user.stripeCustomerId || subscription?.provider !== PaymentProviderType.STRIPE) {
      throw new BadRequestException('Nenhuma assinatura Stripe encontrada para gerenciar.');
    }

    return this.stripeProvider.createPortalSession(user.stripeCustomerId);
  }

  async handleStripeWebhook(
    rawBody: Buffer,
    stripeSignature?: string
  ): Promise<{ received: true }> {
    if (!stripeSignature) {
      throw new BadRequestException('Stripe signature missing');
    }

    let event: Stripe.Event;

    try {
      event = this.stripeProvider.constructWebhookEvent(rawBody, stripeSignature);
    } catch {
      throw new BadRequestException('Invalid Stripe signature');
    }

    if (!STRIPE_WEBHOOK_EVENT_ALLOWLIST.has(event.type)) {
      return { received: true };
    }

    const existingEvent = await this.providerEventRepository.findByProviderEventId(
      PaymentProviderType.STRIPE,
      event.id
    );

    if (existingEvent) {
      return { received: true };
    }

    await this.processStripeEvent(event);
    await this.saveProviderEvent(PaymentProviderType.STRIPE, event.id, event.type);

    return { received: true };
  }

  async handleAsaasWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>
  ): Promise<{ received: true }> {
    const event = this.asaasProvider.parseWebhook(rawBody, headers);
    const existingEvent = await this.providerEventRepository.findByProviderEventId(
      PaymentProviderType.ASAAS,
      event.providerEventId
    );

    if (existingEvent) {
      return { received: true };
    }

    await this.processAsaasEvent(event);
    await this.saveProviderEvent(PaymentProviderType.ASAAS, event.providerEventId, event.type);

    return { received: true };
  }

  private async createStripeCheckout(input: {
    userId: string;
    plan: Exclude<PlanType, PlanType.FREE>;
    billingInterval: BillingInterval;
    currency: BillingCurrency;
  }): Promise<CheckoutResult> {
    const user = await this.getUser(input.userId);
    const customerId = await this.ensureStripeCustomer(user);
    const priceId = this.plansService.getStripePriceId(
      input.plan,
      input.billingInterval,
      input.currency
    );
    const metadata = {
      userId: user.id.value,
      plan: input.plan,
      billingInterval: input.billingInterval,
      currency: input.currency,
      paymentProvider: PaymentProviderType.STRIPE
    };
    const checkout = await this.stripeProvider.createCheckoutSession({
      customerId,
      priceId,
      metadata
    });

    return {
      provider: PaymentProviderType.STRIPE,
      type: 'redirect',
      url: checkout.url
    };
  }

  private async createAsaasPixCheckout(input: {
    userId: string;
    plan: Exclude<PlanType, PlanType.FREE>;
    billingInterval: BillingInterval;
    currency: BillingCurrency;
  }): Promise<CheckoutResult> {
    if (input.currency !== BillingCurrency.BRL) {
      throw new BadRequestException('Pix está disponível apenas em BRL.');
    }

    const user = await this.getUser(input.userId);
    const latestSubscription = await this.subscriptionRepository.findLatestByUserId(user.id.value);
    const now = new Date();
    const calculation = this.planChangeCalculator.calculate({
      currentPlan: user.getEffectivePlan(now),
      currentBillingInterval: latestSubscription?.billingInterval,
      currentCurrency: latestSubscription?.currency,
      currentPlanAccessUntil: user.planAccessUntil,
      targetPlan: input.plan,
      targetBillingInterval: input.billingInterval,
      targetCurrency: input.currency,
      now
    });

    if (calculation.isDowngrade || (!calculation.isUpgrade && calculation.message)) {
      throw new BadRequestException(
        calculation.message ?? 'Não foi possível mudar para este plano agora.'
      );
    }

    const amountToCharge = calculation.shouldCreatePayment ? calculation.amountToPayCents : 0;
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
    const order = PaymentOrder.create({
      userId: user.id.value,
      provider: PaymentProviderType.ASAAS,
      plan: input.plan,
      billingInterval: input.billingInterval,
      currency: BillingCurrency.BRL,
      amountCents: calculation.targetAmountCents,
      status: PaymentStatus.PENDING,
      paymentMethod: PaymentMethodType.PIX,
      accessDays: calculation.accessDays,
      isPlanChange: Boolean(user.planAccessUntil && user.planAccessUntil.getTime() > now.getTime()),
      previousPlan:
        user.getEffectivePlan(now) === PlanType.FREE ? undefined : user.getEffectivePlan(now),
      creditAmountCents: calculation.creditAmountCents,
      amountToPayCents: calculation.amountToPayCents,
      expiresAt,
      createdAt: now,
      updatedAt: now
    });

    await this.paymentOrderRepository.save(order);

    if (!calculation.shouldCreatePayment) {
      order.markPaid({ paidAt: now }, now);
      await this.paymentOrderRepository.save(order);
      await this.applyPaidAsaasOrder(order, now);

      return {
        provider: PaymentProviderType.ASAAS,
        type: 'pix',
        paymentId: order.id.value
      };
    }

    const charge = await this.asaasProvider.createPixCharge({
      order,
      user,
      amount: amountToCharge,
      expiresAt
    });

    if (charge.customerId && user.asaasCustomerId !== charge.customerId) {
      user.updateAsaasCustomerId(charge.customerId);
      await this.userRepository.save(user);
    }

    order.sync({
      providerPaymentId: charge.providerPaymentId,
      checkoutUrl: charge.checkoutUrl,
      qrCodeImage: charge.qrCodeImage,
      qrCodeText: charge.qrCodeText,
      expiresAt: charge.expiresAt
    });
    await this.paymentOrderRepository.save(order);

    return {
      provider: PaymentProviderType.ASAAS,
      type: 'pix',
      paymentId: order.id.value,
      url: order.checkoutUrl,
      qrCodeImage: order.qrCodeImage,
      qrCodeText: order.qrCodeText,
      expiresAt: order.expiresAt
    };
  }

  private async processStripeEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object);
        return;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.syncStripeSubscription(event.data.object);
        return;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        return;
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object);
        return;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object);
        return;
      default:
        return;
    }
  }

  private async processAsaasEvent(event: {
    providerPaymentId?: string;
    correlationId?: string;
    paid: boolean;
    expired: boolean;
    canceled: boolean;
    failed: boolean;
  }): Promise<void> {
    const order =
      (event.providerPaymentId
        ? await this.paymentOrderRepository.findByProviderPaymentId(
            PaymentProviderType.ASAAS,
            event.providerPaymentId
          )
        : null) ??
      (event.correlationId
        ? await this.paymentOrderRepository.findById(event.correlationId)
        : null);

    if (!order) {
      return;
    }

    if (order.status === PaymentStatus.PAID) {
      return;
    }

    if (event.failed) {
      order.markFailed();
      await this.paymentOrderRepository.save(order);
      return;
    }

    if (event.canceled) {
      order.markCanceled();
      await this.paymentOrderRepository.save(order);
      return;
    }

    if (event.expired) {
      order.markExpired();
      await this.paymentOrderRepository.save(order);
      return;
    }

    if (!event.paid) {
      return;
    }

    const now = new Date();
    order.markPaid({ paidAt: now }, now);
    await this.paymentOrderRepository.save(order);
    await this.applyPaidAsaasOrder(order, now);
  }

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const stripeSubscriptionId = getStripeId(session.subscription);

    if (!stripeSubscriptionId) {
      return;
    }

    const subscription = await this.stripeProvider.retrieveSubscription(stripeSubscriptionId);
    await this.syncStripeSubscription(subscription, session.metadata ?? undefined);
  }

  private async syncStripeSubscription(
    stripeSubscription: Stripe.Subscription,
    fallbackMetadata?: Stripe.Metadata | null
  ): Promise<void> {
    const price = stripeSubscription.items.data[0]?.price;
    const priceId = price?.id;

    if (!priceId) {
      return;
    }

    const resolvedPrice = this.plansService.resolvePlanFromStripePriceId(priceId);
    const metadata = stripeSubscription.metadata ?? fallbackMetadata ?? {};
    const plan = resolvedPrice?.plan ?? this.plansService.validatePaidPlan(metadata.plan);
    const billingInterval =
      resolvedPrice?.billingInterval ??
      this.plansService.validateBillingInterval(metadata.billingInterval);
    const currency =
      resolvedPrice?.currency ?? this.plansService.validateBillingCurrency(metadata.currency);
    const userId = metadata.userId;

    if (!userId) {
      return;
    }

    const user = await this.getUser(userId);
    const status = mapStripeSubscriptionStatus(stripeSubscription.status);
    const currentPeriodStart = toDate((stripeSubscription as any).current_period_start);
    const currentPeriodEnd = toDate((stripeSubscription as any).current_period_end);
    const stripeCustomerId = getStripeId(stripeSubscription.customer);
    const existingSubscription = await this.subscriptionRepository.findByStripeSubscriptionId(
      stripeSubscription.id
    );
    const latestInvoiceId = getStripeId((stripeSubscription as any).latest_invoice);
    const subscription =
      existingSubscription ??
      UserSubscription.create({
        userId,
        provider: PaymentProviderType.STRIPE,
        providerCustomerId: stripeCustomerId ?? user.stripeCustomerId,
        providerSubscriptionId: stripeSubscription.id,
        providerPriceId: priceId,
        plan,
        billingInterval,
        currency,
        status,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end
      });

    subscription.sync({
      provider: PaymentProviderType.STRIPE,
      providerCustomerId: stripeCustomerId ?? subscription.providerCustomerId,
      providerSubscriptionId: stripeSubscription.id,
      providerPriceId: priceId,
      plan,
      billingInterval,
      currency,
      status,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      cancelAt: toDate(stripeSubscription.cancel_at),
      canceledAt: toDate(stripeSubscription.canceled_at),
      latestInvoiceId
    });
    await this.subscriptionRepository.save(subscription);

    if (stripeCustomerId && user.stripeCustomerId !== stripeCustomerId) {
      user.updateStripeCustomerId(stripeCustomerId);
    }

    this.applySubscriptionAccess(user, subscription);
    await this.userRepository.save(user);
  }

  private async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription): Promise<void> {
    const existingSubscription = await this.subscriptionRepository.findByStripeSubscriptionId(
      stripeSubscription.id
    );

    if (!existingSubscription) {
      return;
    }

    existingSubscription.sync({
      status: SubscriptionStatus.CANCELED,
      canceledAt: toDate(stripeSubscription.canceled_at) ?? new Date(),
      cancelAtPeriodEnd: false
    });
    await this.subscriptionRepository.save(existingSubscription);

    const user = await this.getUser(existingSubscription.userId);
    user.downgradeToFree();
    await this.userRepository.save(user);
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const stripeSubscriptionId = getStripeId((invoice as any).subscription);

    if (!stripeSubscriptionId) {
      return;
    }

    const subscription = await this.stripeProvider.retrieveSubscription(stripeSubscriptionId);
    await this.syncStripeSubscription(subscription);
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const stripeSubscriptionId = getStripeId((invoice as any).subscription);

    if (!stripeSubscriptionId) {
      return;
    }

    const subscription =
      await this.subscriptionRepository.findByStripeSubscriptionId(stripeSubscriptionId);

    if (!subscription) {
      return;
    }

    subscription.sync({ status: SubscriptionStatus.PAST_DUE });
    await this.subscriptionRepository.save(subscription);

    const user = await this.getUser(subscription.userId);
    user.markBillingStatus(SubscriptionStatus.PAST_DUE, subscription.currentPeriodEnd);
    await this.userRepository.save(user);
  }

  private applySubscriptionAccess(user: User, subscription: UserSubscription): void {
    if (ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
      user.activatePaidPlan({
        plan: subscription.plan === PlanType.FREE ? PlanType.STANDARD : subscription.plan,
        billingProvider: subscription.provider,
        billingStatus: subscription.status,
        planAccessUntil: subscription.currentPeriodEnd,
        currentSubscriptionId: subscription.providerSubscriptionId,
        stripeCustomerId:
          subscription.provider === PaymentProviderType.STRIPE
            ? subscription.providerCustomerId
            : undefined,
        asaasCustomerId:
          subscription.provider === PaymentProviderType.ASAAS
            ? subscription.providerCustomerId
            : undefined
      });
      return;
    }

    if (
      subscription.cancelAtPeriodEnd &&
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd.getTime() > Date.now()
    ) {
      user.activatePaidPlan({
        plan: subscription.plan === PlanType.FREE ? PlanType.STANDARD : subscription.plan,
        billingProvider: subscription.provider,
        billingStatus: subscription.status,
        planAccessUntil: subscription.currentPeriodEnd,
        currentSubscriptionId: subscription.providerSubscriptionId,
        stripeCustomerId:
          subscription.provider === PaymentProviderType.STRIPE
            ? subscription.providerCustomerId
            : undefined,
        asaasCustomerId:
          subscription.provider === PaymentProviderType.ASAAS
            ? subscription.providerCustomerId
            : undefined
      });
      return;
    }

    if (subscription.status === SubscriptionStatus.PAST_DUE && subscription.currentPeriodEnd) {
      user.markBillingStatus(SubscriptionStatus.PAST_DUE, subscription.currentPeriodEnd);
      return;
    }

    user.downgradeToFree();
  }

  private async saveProviderEvent(
    provider: PaymentProviderType,
    providerEventId: string,
    type: string
  ): Promise<void> {
    await this.providerEventRepository.save(
      ProviderEvent.create({
        provider,
        providerEventId,
        type,
        processedAt: new Date()
      })
    );
  }

  private async applyPaidAsaasOrder(order: PaymentOrder, referenceDate: Date): Promise<void> {
    const accessEnd = getAsaasAccessEnd(order.accessDays, referenceDate);
    const providerSubscriptionId = order.providerPaymentId ?? order.id.value;
    const user = await this.getUser(order.userId);
    const asaasCustomerId = user.asaasCustomerId ?? user.id.value;
    const existingSubscription = await this.subscriptionRepository.findByProviderSubscriptionId(
      PaymentProviderType.ASAAS,
      providerSubscriptionId
    );
    const subscription =
      existingSubscription ??
      UserSubscription.create({
        userId: order.userId,
        provider: PaymentProviderType.ASAAS,
        providerCustomerId: asaasCustomerId,
        providerSubscriptionId,
        plan: order.plan === PlanType.FREE ? PlanType.STANDARD : order.plan,
        billingInterval: order.billingInterval,
        currency: order.currency,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: referenceDate,
        currentPeriodEnd: accessEnd,
        cancelAtPeriodEnd: true,
        createdAt: referenceDate,
        updatedAt: referenceDate
      });

    subscription.sync(
      {
        provider: PaymentProviderType.ASAAS,
        providerCustomerId: asaasCustomerId,
        providerSubscriptionId,
        plan: order.plan === PlanType.FREE ? PlanType.STANDARD : order.plan,
        billingInterval: order.billingInterval,
        currency: order.currency,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: referenceDate,
        currentPeriodEnd: accessEnd,
        cancelAtPeriodEnd: true
      },
      referenceDate
    );
    await this.subscriptionRepository.save(subscription);

    user.activatePaidPlan(
      {
        plan: order.plan === PlanType.FREE ? PlanType.STANDARD : order.plan,
        billingProvider: PaymentProviderType.ASAAS,
        billingStatus: SubscriptionStatus.ACTIVE,
        planAccessUntil: accessEnd,
        currentSubscriptionId: providerSubscriptionId,
        asaasCustomerId
      },
      referenceDate
    );
    await this.userRepository.save(user);
  }

  private async getUser(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.hasScheduledDeletion()) {
      throw new ForbiddenException('Account is unavailable');
    }

    return user;
  }
}

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  const normalizedStatus = status as SubscriptionStatus;

  if (Object.values(SubscriptionStatus).includes(normalizedStatus)) {
    return normalizedStatus;
  }

  return SubscriptionStatus.NONE;
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

function toDate(timestamp?: number | null): Date | undefined {
  return typeof timestamp === 'number' ? new Date(timestamp * 1000) : undefined;
}

function getAsaasAccessEnd(accessDays: number, accessStart: Date): Date {
  if (accessDays >= 365) {
    const end = new Date(accessStart);
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    return end;
  }

  return new Date(accessStart.getTime() + accessDays * 24 * 60 * 60 * 1000);
}
