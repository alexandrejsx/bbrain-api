import { UserDailyUsage } from '../../usage/entities/user-daily-usage.entity';
import { UserDailyUsageRepository } from '../../usage/repositories/user-daily-usage.repository';
import { UsageLimitError, UsageService } from '../../usage/services/usage.service';
import { User } from '../../users/entities/user.entity';
import { UserRepository } from '../../users/repositories/user.repository';
import { Email } from '../../users/value-objects/email.vo';
import { UserName } from '../../users/value-objects/user-name.vo';
import { PaymentProviderType, PlanType, SubscriptionStatus } from '../../plans/plan-definition';

class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  add(user: User): void {
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

class InMemoryDailyUsageRepository implements UserDailyUsageRepository {
  readonly usages = new Map<string, UserDailyUsage>();

  findActiveByUserId(userId: string, referenceDate: Date): Promise<UserDailyUsage | null> {
    const usages = [...this.usages.values()]
      .filter(
        (usage) => usage.userId === userId && usage.periodEnd.getTime() > referenceDate.getTime()
      )
      .sort((left, right) => right.periodEnd.getTime() - left.periodEnd.getTime());

    return Promise.resolve(usages[0] ?? null);
  }

  save(usage: UserDailyUsage): Promise<void> {
    this.usages.set(`${usage.userId}:${usage.dateKey}`, usage);
    return Promise.resolve();
  }
}

function createUser(plan: PlanType = PlanType.FREE): User {
  return User.register({
    name: new UserName('Usuário'),
    email: new Email(`usuario-${Math.random()}@bbrain.com`),
    passwordHash: 'hashed-password',
    timezone: 'America/Sao_Paulo',
    plan,
    acceptedTermsAt: new Date('2026-01-01T00:00:00.000Z')
  });
}

describe('UsageService', () => {
  let userRepository: InMemoryUserRepository;
  let usageRepository: InMemoryDailyUsageRepository;
  let now: Date;
  let service: UsageService;
  let user: User;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    usageRepository = new InMemoryDailyUsageRepository();
    now = new Date('2026-01-01T12:00:00.000Z');
    service = new UsageService(usageRepository, userRepository, () => now);
    user = createUser();
    userRepository.add(user);
  });

  it('allows a user inside the daily limits to send a message', async () => {
    await expect(service.assertCanSendMessage(user.id.value, 'Oi')).resolves.toBeUndefined();
  });

  it('blocks a user who reached the daily message limit', async () => {
    const usage = await service.getCurrentUsage(user.id.value);

    for (let index = 0; index < 20; index += 1) {
      usage.registerLlmUsage({ inputTokens: 1, outputTokens: 1, totalTokens: 2 }, now);
    }
    await usageRepository.save(usage);

    await expect(service.assertCanSendMessage(user.id.value, 'Oi')).rejects.toMatchObject({
      code: 'USAGE_MESSAGE_LIMIT_REACHED'
    });
    expect((await service.getCurrentUsage(user.id.value)).blockedCount).toBe(1);
  });

  it('blocks a user who reached the daily token limit', async () => {
    const usage = await service.getCurrentUsage(user.id.value);
    usage.registerLlmUsage({ inputTokens: 30_000, outputTokens: 0, totalTokens: 30_000 }, now);
    await usageRepository.save(usage);

    await expect(service.assertCanSendMessage(user.id.value, 'Oi')).rejects.toMatchObject({
      code: 'USAGE_TOKEN_LIMIT_REACHED'
    });
  });

  it('blocks a message above the plan maximum length', async () => {
    await expect(
      service.assertCanSendMessage(user.id.value, 'a'.repeat(2_001))
    ).rejects.toMatchObject({
      code: 'USER_MESSAGE_TOO_LONG'
    });
  });

  it('registers LLM usage and increments the message count', async () => {
    await service.registerLlmUsage(user.id.value, {
      inputTokens: 10,
      outputTokens: 12,
      totalTokens: 22
    });

    const summary = await service.getUsageSummary(user.id.value);

    expect(summary).toMatchObject({
      inputTokens: 10,
      outputTokens: 12,
      totalTokens: 22,
      messageCount: 1
    });
  });

  it('uses paid plan limits when the subscription is active', async () => {
    user.activatePaidPlan({
      plan: PlanType.PRO,
      billingProvider: PaymentProviderType.STRIPE,
      billingStatus: SubscriptionStatus.ACTIVE,
      planAccessUntil: new Date('2026-02-01T00:00:00.000Z'),
      currentSubscriptionId: 'sub_active'
    });
    await userRepository.save(user);

    const summary = await service.getUsageSummary(user.id.value);

    expect(summary.plan).toBe(PlanType.PRO);
    expect(summary.dailyMessageLimit).toBe(300);
  });

  it('falls back to free limits when paid access is expired', async () => {
    user.activatePaidPlan({
      plan: PlanType.STANDARD,
      billingProvider: PaymentProviderType.STRIPE,
      billingStatus: SubscriptionStatus.ACTIVE,
      planAccessUntil: new Date('2025-12-31T23:59:59.000Z'),
      currentSubscriptionId: 'sub_expired'
    });
    await userRepository.save(user);

    const summary = await service.getUsageSummary(user.id.value);

    expect(summary.plan).toBe(PlanType.FREE);
    expect(summary.dailyMessageLimit).toBe(20);
  });

  it('creates a new usage record after the current 24-hour window expires', async () => {
    const firstUsage = await service.getCurrentUsage(user.id.value);
    now = new Date('2026-01-02T12:00:00.000Z');

    const secondUsage = await service.getCurrentUsage(user.id.value);

    expect(firstUsage.dateKey).toBe('2026-01-01T12');
    expect(secondUsage.dateKey).toBe('2026-01-02T12');
    expect(usageRepository.usages.size).toBe(2);
  });

  it('extends the reset to 24 hours after the hour when the limit was reached', async () => {
    now = new Date('2026-01-01T09:15:00.000Z');
    const usage = await service.getCurrentUsage(user.id.value);

    now = new Date('2026-01-01T13:42:00.000Z');
    usage.registerLlmUsage({ inputTokens: 30_000, outputTokens: 0, totalTokens: 30_000 }, now);
    await usageRepository.save(usage);

    await expect(service.assertCanSendMessage(user.id.value, 'Oi')).rejects.toMatchObject({
      code: 'USAGE_TOKEN_LIMIT_REACHED'
    });

    expect((await service.getCurrentUsage(user.id.value)).periodEnd.toISOString()).toBe(
      '2026-01-02T13:00:00.000Z'
    );
  });

  it('returns an invalid plan error and increments blocked count', async () => {
    const invalidUser = User.create({
      name: new UserName('Usuário'),
      email: new Email(`usuario-invalido-${Math.random()}@bbrain.com`),
      passwordHash: 'hashed-password',
      timezone: 'America/Sao_Paulo',
      plan: 'invalid' as PlanType,
      billingStatus: SubscriptionStatus.ACTIVE,
      acceptedTermsAt: new Date('2026-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    });
    userRepository.add(invalidUser);

    await expect(service.assertCanSendMessage(invalidUser.id.value, 'Oi')).rejects.toBeInstanceOf(
      UsageLimitError
    );

    const usage = await service.getCurrentUsage(invalidUser.id.value);

    expect(usage.blockedCount).toBe(1);
  });
});
