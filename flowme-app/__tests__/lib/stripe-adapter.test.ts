import {
  normalizeStripeSubscriptionStatus,
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
    expect(normalizeStripeSubscriptionStatus('unpaid')).toBe('past_due');
    expect(normalizeStripeSubscriptionStatus('canceled')).toBe('canceled');
    expect(normalizeStripeSubscriptionStatus('incomplete')).toBe('incomplete');
    expect(normalizeStripeSubscriptionStatus('incomplete_expired')).toBe('expired');
  });
});
