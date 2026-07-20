import { ForbiddenException } from '@nestjs/common';
import { InsightsController } from '../../../controllers/insights.controller';
import { PlanType } from '../../plans/plan-definition';
import { User } from '../../users/entities/user.entity';
import { UserRepository } from '../../users/repositories/user.repository';
import { Email } from '../../users/value-objects/email.vo';
import { UserName } from '../../users/value-objects/user-name.vo';
import { ListInsightsService } from '../../../use-cases/insights/list-insights.service';

class SingleUserRepository implements UserRepository {
  constructor(private readonly user: User) {}

  findById(id: string): Promise<User | null> {
    return Promise.resolve(id === this.user.id.value ? this.user : null);
  }

  findByEmail(): Promise<User | null> {
    return Promise.resolve(null);
  }

  findScheduledForDeletionDueBefore(): Promise<User[]> {
    return Promise.resolve([]);
  }

  save(): Promise<void> {
    return Promise.resolve();
  }

  delete(): Promise<void> {
    return Promise.resolve();
  }
}

describe('InsightsController', () => {
  it('maps the Pro entitlement denial to a stable HTTP 403 response', async () => {
    const user = User.register({
      name: new UserName('Usuário Free'),
      email: new Email('free-controller@bbrain.com'),
      passwordHash: 'hashed-password',
      plan: PlanType.FREE,
      acceptedTermsAt: new Date('2026-01-01T00:00:00.000Z')
    });
    const controller = new InsightsController(
      new ListInsightsService(new SingleUserRepository(user))
    );

    try {
      await controller.list({ headers: {}, user: { id: user.id.value } });
      throw new Error('Expected controller to reject a non-Pro user');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getStatus()).toBe(403);
      expect((error as ForbiddenException).getResponse()).toEqual({
        code: 'INSIGHTS_PRO_REQUIRED',
        message: 'An active Pro plan is required to access insights.'
      });
    }
  });
});
