import {
  BillingCurrency,
  BillingInterval,
  getPublicPlanDefinitions,
  normalizePlanType,
  PLAN_DEFINITIONS,
  PlanType
} from '../../plans/plan-definition';
import { PlansService } from '../../../use-cases/plans/plans.service';

describe('Plan definitions', () => {
  it('defines the initial account plans', () => {
    expect(Object.keys(PLAN_DEFINITIONS).sort()).toEqual([
      PlanType.FREE,
      PlanType.PRO,
      PlanType.STANDARD
    ]);
  });

  it('defines all required usage limits for every plan', () => {
    for (const plan of Object.values(PLAN_DEFINITIONS)) {
      expect(plan.dailyTokenLimit).toBeGreaterThan(0);
      expect(plan.dailyMessageLimit).toBeGreaterThan(0);
      expect(plan.maxUserMessageLength).toBeGreaterThan(0);
      expect(plan.features.length).toBeGreaterThan(0);
    }
  });

  it('maps the legacy premium plan to pro', () => {
    expect(normalizePlanType('premium')).toBe(PlanType.PRO);
  });

  it('does not expose Stripe price environment keys publicly', () => {
    const publicPlans = getPublicPlanDefinitions();

    expect(JSON.stringify(publicPlans)).not.toContain('stripePriceEnvKey');
    expect(JSON.stringify(publicPlans)).not.toContain('STRIPE_PRICE_');
  });

  it('keeps public prices and Pix amounts in cents in the central definition', () => {
    expect(PLAN_DEFINITIONS.standard.prices.brl.monthly.amount).toBe(1_990);
    expect(PLAN_DEFINITIONS.standard.prices.brl.yearly.pixAmount).toBe(17_880);
    expect(PLAN_DEFINITIONS.pro.prices.usd.yearly.amount).toBe(14_388);
  });

  it('resolves Stripe price IDs only from environment keys', () => {
    const service = new PlansService();
    const previous = process.env.STRIPE_PRICE_STANDARD_MONTHLY_BRL;
    process.env.STRIPE_PRICE_STANDARD_MONTHLY_BRL = 'price_standard_monthly_brl';

    expect(
      service.getStripePriceId(PlanType.STANDARD, BillingInterval.MONTHLY, BillingCurrency.BRL)
    ).toBe('price_standard_monthly_brl');

    if (previous === undefined) {
      delete process.env.STRIPE_PRICE_STANDARD_MONTHLY_BRL;
    } else {
      process.env.STRIPE_PRICE_STANDARD_MONTHLY_BRL = previous;
    }
  });

  it('rejects Pix outside BRL', () => {
    const service = new PlansService();

    expect(() =>
      service.getPixAmount(PlanType.PRO, BillingInterval.YEARLY, BillingCurrency.USD)
    ).toThrow('Pix está disponível apenas em BRL.');
  });
});
