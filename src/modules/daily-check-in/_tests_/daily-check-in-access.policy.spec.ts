import { PlanType } from '../../../domain/plans/plan-definition';
import { DailyCheckInAccessPolicy } from '../daily-check-in-access.policy';

describe('DailyCheckInAccessPolicy', () => {
  const policy = new DailyCheckInAccessPolicy();

  it('grants every new user a seven-day trial', () => {
    const user = {
      createdAt: new Date('2026-08-10T12:00:00Z'),
      getEffectivePlan: () => PlanType.FREE
    };
    expect(policy.resolve(user as never, new Date('2026-08-17T11:59:59Z'))).toEqual({
      available: true,
      accessReason: 'trial'
    });
  });

  it('uses the effective paid plan after trial and locks free accounts', () => {
    const createdAt = new Date('2026-08-01T00:00:00Z');
    expect(
      policy.resolve(
        { createdAt, getEffectivePlan: () => PlanType.STANDARD } as never,
        new Date('2026-08-17T00:00:00Z')
      )
    ).toEqual({ available: true, accessReason: 'plan' });
    expect(
      policy.resolve(
        { createdAt, getEffectivePlan: () => PlanType.FREE } as never,
        new Date('2026-08-17T00:00:00Z')
      )
    ).toEqual({ available: false, accessReason: 'locked' });
  });
});
