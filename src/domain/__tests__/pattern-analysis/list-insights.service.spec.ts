import {
  InsightsProPlanRequiredError,
  InsightsUserNotFoundError,
  ListInsightsService
} from '../../../use-cases/insights/list-insights.service';
import { PaymentProviderType, PlanType, SubscriptionStatus } from '../../plans/plan-definition';
import { User } from '../../users/entities/user.entity';
import { UserRepository } from '../../users/repositories/user.repository';
import { Email } from '../../users/value-objects/email.vo';
import { UserName } from '../../users/value-objects/user-name.vo';

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

function createUser(plan = PlanType.FREE): User {
  return User.register({
    name: new UserName('Usuário'),
    email: new Email(`${plan}@bbrain.com`),
    passwordHash: 'hashed-password',
    timezone: 'America/Sao_Paulo',
    plan,
    acceptedTermsAt: new Date('2026-01-01T00:00:00.000Z')
  });
}

describe('ListInsightsService', () => {
  const now = new Date('2026-07-20T12:00:00.000Z');
  let repository: InMemoryUserRepository;
  let service: ListInsightsService;

  beforeEach(() => {
    repository = new InMemoryUserRepository();
    service = new ListInsightsService(repository);
  });

  it.each([PlanType.FREE, PlanType.STANDARD])(
    'rejects an effective %s plan without producing insights',
    async (plan) => {
      const user = createUser(plan);

      if (plan === PlanType.STANDARD) {
        user.activatePaidPlan({
          plan,
          billingProvider: PaymentProviderType.STRIPE,
          billingStatus: SubscriptionStatus.ACTIVE,
          planAccessUntil: new Date('2026-08-20T00:00:00.000Z')
        });
      }
      repository.add(user);

      await expect(service.execute(user.id.value, now)).rejects.toBeInstanceOf(
        InsightsProPlanRequiredError
      );
    }
  );

  it('rejects a Pro account whose paid access is no longer effective', async () => {
    const user = createUser(PlanType.PRO);
    user.activatePaidPlan({
      plan: PlanType.PRO,
      billingProvider: PaymentProviderType.STRIPE,
      billingStatus: SubscriptionStatus.ACTIVE,
      planAccessUntil: new Date('2026-07-19T00:00:00.000Z')
    });
    repository.add(user);

    await expect(service.execute(user.id.value, now)).rejects.toMatchObject({
      code: 'INSIGHTS_PRO_REQUIRED'
    });
  });

  it('returns an explicit empty result for an effective Pro plan', async () => {
    const user = createUser(PlanType.PRO);
    user.activatePaidPlan({
      plan: PlanType.PRO,
      billingProvider: PaymentProviderType.STRIPE,
      billingStatus: SubscriptionStatus.ACTIVE,
      planAccessUntil: new Date('2026-08-20T00:00:00.000Z')
    });
    repository.add(user);

    await expect(service.execute(user.id.value, now)).resolves.toEqual({
      status: 'insufficient_data',
      items: [],
      policyVersion: 'insights-read-v1'
    });
  });

  it('does not disclose an insights result when the user no longer exists', async () => {
    await expect(service.execute('missing-user', now)).rejects.toBeInstanceOf(
      InsightsUserNotFoundError
    );
  });
});
