import { AggregateRoot } from '../../core/aggregate-root';
import { UserCreatedEvent } from '../events/user-created.event';
import { UserLoggedInEvent } from '../events/user-logged-in.event';
import type { UserProfileSnapshot } from './user-profile.types';
import { Email } from '../value-objects/email.vo';
import { UserName } from '../value-objects/user-name.vo';
import { Uuid } from '../../shared/uuid.vo';
import {
  DEFAULT_PLAN,
  isPlanType,
  PaymentProviderType,
  PlanType,
  SubscriptionStatus
} from '../../plans/plan-definition';

export interface UserProps {
  name: UserName;
  email: Email;
  passwordHash: string;
  phone?: string;
  passwordResetCodeHash?: string;
  passwordResetCodeExpiresAt?: Date;
  timezone: string;
  plan: PlanType;
  billingProvider?: PaymentProviderType;
  stripeCustomerId?: string;
  asaasCustomerId?: string;
  billingStatus: SubscriptionStatus;
  planAccessUntil?: Date;
  currentSubscriptionId?: string;
  acceptedTermsAt: Date;
  profile?: UserProfileSnapshot;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  accountDeactivatedAt?: Date;
  accountScheduledDeletionAt?: Date;
}

export class User extends AggregateRoot<UserProps> {
  private constructor(
    private readonly props: UserProps,
    id?: Uuid
  ) {
    super();
    this.id = id ?? Uuid.create();
  }

  static create(props: UserProps, id?: Uuid): User {
    return new User(props, id);
  }

  static register(
    props: Omit<UserProps, 'createdAt' | 'updatedAt' | 'timezone' | 'plan' | 'billingStatus'> & {
      timezone?: string;
      plan?: PlanType;
      billingStatus?: SubscriptionStatus;
      createdAt?: Date;
      updatedAt?: Date;
    },
    id?: Uuid
  ): User {
    const now = new Date();
    const user = new User(
      {
        ...props,
        timezone: props.timezone ?? 'America/Sao_Paulo',
        plan: props.plan ?? DEFAULT_PLAN,
        billingStatus: props.billingStatus ?? SubscriptionStatus.NONE,
        createdAt: props.createdAt ?? now,
        updatedAt: props.updatedAt ?? now
      },
      id
    );

    user.addDomainEvent(new UserCreatedEvent(user.id.value));

    return user;
  }

  markLoggedIn(date = new Date()): void {
    this.props.lastLoginAt = date;
    this.props.updatedAt = date;
    this.addDomainEvent(new UserLoggedInEvent(this.id.value));
  }

  updateBasicInfo(
    input: {
      name: string;
      timezone?: string;
    },
    date = new Date()
  ): void {
    this.props.name = new UserName(input.name);
    this.props.timezone = input.timezone ?? this.props.timezone;
    this.props.updatedAt = date;
  }

  updateProfile(profile: UserProfileSnapshot, date = new Date()): void {
    this.props.profile = profile;
    this.props.updatedAt = date;
  }

  updatePhone(phone?: string, date = new Date()): void {
    this.props.phone = phone;
    this.props.updatedAt = date;
  }

  updatePlan(plan: PlanType, date = new Date()): void {
    if (!isPlanType(plan)) {
      throw new Error('Invalid user plan');
    }

    this.props.plan = plan;
    this.props.updatedAt = date;
  }

  updateStripeCustomerId(stripeCustomerId: string, date = new Date()): void {
    this.props.stripeCustomerId = stripeCustomerId;
    this.props.updatedAt = date;
  }

  updateAsaasCustomerId(asaasCustomerId: string, date = new Date()): void {
    this.props.asaasCustomerId = asaasCustomerId;
    this.props.updatedAt = date;
  }

  activatePaidPlan(
    input: {
      plan: Exclude<PlanType, PlanType.FREE>;
      billingStatus: SubscriptionStatus;
      billingProvider: PaymentProviderType;
      planAccessUntil?: Date;
      currentSubscriptionId?: string;
      stripeCustomerId?: string;
      asaasCustomerId?: string;
    },
    date = new Date()
  ): void {
    if (!isPlanType(input.plan)) {
      throw new Error('Invalid paid user plan');
    }

    this.props.plan = input.plan;
    this.props.billingStatus = input.billingStatus;
    this.props.billingProvider = input.billingProvider;
    this.props.planAccessUntil = input.planAccessUntil;
    this.props.currentSubscriptionId = input.currentSubscriptionId;
    this.props.stripeCustomerId = input.stripeCustomerId ?? this.props.stripeCustomerId;
    this.props.asaasCustomerId = input.asaasCustomerId ?? this.props.asaasCustomerId;
    this.props.updatedAt = date;
  }

  markBillingStatus(
    billingStatus: SubscriptionStatus,
    planAccessUntil = this.props.planAccessUntil,
    date = new Date()
  ): void {
    this.props.billingStatus = billingStatus;
    this.props.planAccessUntil = planAccessUntil;
    this.props.updatedAt = date;
  }

  downgradeToFree(date = new Date()): void {
    this.props.plan = PlanType.FREE;
    this.props.billingStatus = SubscriptionStatus.NONE;
    this.props.billingProvider = undefined;
    this.props.planAccessUntil = undefined;
    this.props.currentSubscriptionId = undefined;
    this.props.updatedAt = date;
  }

  getEffectivePlan(date = new Date()): PlanType {
    if (this.props.plan === PlanType.FREE) {
      return PlanType.FREE;
    }

    if (
      (this.props.billingStatus === SubscriptionStatus.ACTIVE ||
        this.props.billingStatus === SubscriptionStatus.TRIALING) &&
      (!this.props.planAccessUntil || this.props.planAccessUntil.getTime() > date.getTime())
    ) {
      return this.props.plan;
    }

    if (this.props.planAccessUntil && this.props.planAccessUntil.getTime() > date.getTime()) {
      return this.props.plan;
    }

    return PlanType.FREE;
  }

  updatePasswordHash(passwordHash: string, date = new Date()): void {
    this.props.passwordHash = passwordHash;
    this.clearPasswordReset(date);
    this.props.updatedAt = date;
  }

  schedulePasswordReset(codeHash: string, expiresAt: Date, date = new Date()): void {
    this.props.passwordResetCodeHash = codeHash;
    this.props.passwordResetCodeExpiresAt = expiresAt;
    this.props.updatedAt = date;
  }

  clearPasswordReset(date = new Date()): void {
    this.props.passwordResetCodeHash = undefined;
    this.props.passwordResetCodeExpiresAt = undefined;
    this.props.updatedAt = date;
  }

  hasActivePasswordReset(date = new Date()): boolean {
    return Boolean(
      this.props.passwordResetCodeHash &&
      this.props.passwordResetCodeExpiresAt &&
      this.props.passwordResetCodeExpiresAt.getTime() > date.getTime()
    );
  }

  scheduleDeletion(gracePeriodDays: number, date = new Date()): void {
    this.props.accountDeactivatedAt = date;
    this.props.accountScheduledDeletionAt = new Date(
      date.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000
    );
    this.props.updatedAt = date;
  }

  reactivate(date = new Date()): void {
    this.props.accountDeactivatedAt = undefined;
    this.props.accountScheduledDeletionAt = undefined;
    this.props.updatedAt = date;
  }

  hasScheduledDeletion(): boolean {
    return Boolean(this.props.accountDeactivatedAt && this.props.accountScheduledDeletionAt);
  }

  canBeReactivated(date = new Date()): boolean {
    return this.hasScheduledDeletion() && !this.isDeletionDue(date);
  }

  isDeletionDue(date = new Date()): boolean {
    return Boolean(
      this.props.accountScheduledDeletionAt &&
      this.props.accountScheduledDeletionAt.getTime() <= date.getTime()
    );
  }

  get name(): UserName {
    return this.props.name;
  }

  get email(): Email {
    return this.props.email;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get phone(): string | undefined {
    return this.props.phone;
  }

  get passwordResetCodeHash(): string | undefined {
    return this.props.passwordResetCodeHash;
  }

  get passwordResetCodeExpiresAt(): Date | undefined {
    return this.props.passwordResetCodeExpiresAt;
  }

  get timezone(): string {
    return this.props.timezone;
  }

  get plan(): PlanType {
    return this.props.plan;
  }

  get billingProvider(): PaymentProviderType | undefined {
    return this.props.billingProvider;
  }

  get stripeCustomerId(): string | undefined {
    return this.props.stripeCustomerId;
  }

  get asaasCustomerId(): string | undefined {
    return this.props.asaasCustomerId;
  }

  get billingStatus(): SubscriptionStatus {
    return this.props.billingStatus;
  }

  get planAccessUntil(): Date | undefined {
    return this.props.planAccessUntil;
  }

  get currentSubscriptionId(): string | undefined {
    return this.props.currentSubscriptionId;
  }

  get acceptedTermsAt(): Date {
    return this.props.acceptedTermsAt;
  }

  get profile(): UserProfileSnapshot | undefined {
    return this.props.profile;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get lastLoginAt(): Date | undefined {
    return this.props.lastLoginAt;
  }

  get accountDeactivatedAt(): Date | undefined {
    return this.props.accountDeactivatedAt;
  }

  get accountScheduledDeletionAt(): Date | undefined {
    return this.props.accountScheduledDeletionAt;
  }

  toJson() {
    return {
      id: this.id.value,
      name: this.name.value,
      email: this.email.value,
      phone: this.phone,
      timezone: this.timezone,
      plan: this.plan,
      billingProvider: this.billingProvider,
      billingStatus: this.billingStatus,
      planAccessUntil: this.planAccessUntil?.toISOString(),
      currentSubscriptionId: this.currentSubscriptionId,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      lastLoginAt: this.lastLoginAt?.toISOString()
    };
  }
}
