import {
  assertStripeProPrice,
  normalizeStripeSubscriptionStatus,
  stripeSubscriptionToRow,
  stripePriceEnvName,
  stripePriceIdForInterval,
} from '@/lib/billing/stripe-adapter';

describe('stripe billing adapter', () => {
  const oldEnv = process.env;

  beforeEach(() => {
    process.env = { ...oldEnv };
  });

  afterAll(() => {
    process.env = oldEnv;
  });

  it('resolves monthly and annual price env names', () => {
    expect(stripePriceEnvName('monthly')).toBe('STRIPE_PRO_MONTHLY_PRICE_ID');
    expect(stripePriceEnvName('annual')).toBe('STRIPE_PRO_ANNUAL_PRICE_ID');
  });

  it('returns configured Stripe price IDs by interval', () => {
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID = 'price_monthly';
    process.env.STRIPE_PRO_ANNUAL_PRICE_ID = 'price_annual';

    expect(stripePriceIdForInterval('monthly')).toBe('price_monthly');
    expect(stripePriceIdForInterval('annual')).toBe('price_annual');
  });

  it('rejects missing Stripe price IDs', () => {
    delete process.env.STRIPE_PRO_MONTHLY_PRICE_ID;

    expect(() => stripePriceIdForInterval('monthly')).toThrow('STRIPE_PRO_MONTHLY_PRICE_ID is not configured');
  });

  it('maps Stripe statuses to provider-agnostic states', () => {
    expect(normalizeStripeSubscriptionStatus('trialing')).toBe('trialing');
    expect(normalizeStripeSubscriptionStatus('active')).toBe('active');
    expect(normalizeStripeSubscriptionStatus('past_due')).toBe('past_due');
    expect(normalizeStripeSubscriptionStatus('unpaid')).toBe('expired');
    expect(normalizeStripeSubscriptionStatus('canceled')).toBe('canceled');
    expect(normalizeStripeSubscriptionStatus('incomplete')).toBe('incomplete');
    expect(normalizeStripeSubscriptionStatus('incomplete_expired')).toBe('expired');
  });

  it('accepts only configured Pro price IDs before mapping a subscription row', () => {
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID = 'price_monthly';
    process.env.STRIPE_PRO_ANNUAL_PRICE_ID = 'price_annual';

    expect(assertStripeProPrice('price_monthly')).toBe('price_monthly');
    expect(() => assertStripeProPrice('price_other')).toThrow('Stripe subscription price is not configured for Pro: price_other');

    const row = stripeSubscriptionToRow({
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      cancel_at_period_end: false,
      metadata: { user_id: 'user-1' },
      items: { data: [{ price: { id: 'price_annual' }, current_period_start: 1780704000, current_period_end: 1783296000 }] },
    } as any);

    expect(row.plan_code).toBe('pro');
    expect(row.metadata.price_id).toBe('price_annual');
    expect(row.current_period_start).toBe(new Date(1780704000 * 1000).toISOString());
  });
});
