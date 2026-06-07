import {
  FEATURE_KEYS,
  FREE_AI_CREDITS_PER_DAY,
  computeEntitlementsFromSubscription,
  getDefaultFreeEntitlements,
  isFeatureAllowed,
  normalizeSubscriptionStatus,
} from '@/lib/billing/entitlements';

describe('billing entitlements', () => {
  it('defaults users to Free with notes and limited Balys only', () => {
    const entitlements = getDefaultFreeEntitlements('user-1');

    expect(entitlements.plan_code).toBe('free');
    expect(entitlements.has_pro).toBe(false);
    expect(entitlements.ai_credits.daily_limit).toBe(FREE_AI_CREDITS_PER_DAY);
    expect(isFeatureAllowed(entitlements, 'notes')).toBe(true);
    expect(isFeatureAllowed(entitlements, 'balys_limited')).toBe(true);
    expect(isFeatureAllowed(entitlements, 'finance')).toBe(false);
    expect(isFeatureAllowed(entitlements, 'meetings')).toBe(false);
  });

  it('grants every feature for an active Pro subscription', () => {
    const entitlements = computeEntitlementsFromSubscription('user-1', {
      plan_code: 'pro',
      status: 'active',
      current_period_end: '2026-07-06T00:00:00.000Z',
    }, new Date('2026-06-06T00:00:00.000Z'));

    expect(entitlements.plan_code).toBe('pro');
    expect(entitlements.has_pro).toBe(true);
    expect(entitlements.ai_credits.unlimited).toBe(true);
    for (const feature of FEATURE_KEYS) {
      expect(isFeatureAllowed(entitlements, feature)).toBe(true);
    }
  });

  it('keeps Pro during a valid grace period and downgrades account hold to Free', () => {
    const grace = computeEntitlementsFromSubscription('user-1', {
      plan_code: 'pro',
      status: 'grace_period',
      grace_period_ends_at: '2026-06-10T00:00:00.000Z',
    }, new Date('2026-06-06T00:00:00.000Z'));
    const hold = computeEntitlementsFromSubscription('user-1', {
      plan_code: 'pro',
      status: 'account_hold',
    });

    expect(grace.has_pro).toBe(true);
    expect(grace.access_until).toBe('2026-06-10T00:00:00.000Z');
    expect(hold.has_pro).toBe(false);
    expect(hold.plan_code).toBe('free');
  });

  it('does not grant Pro for expired active or open-ended past_due subscriptions', () => {
    const expiredActive = computeEntitlementsFromSubscription('user-1', {
      plan_code: 'pro',
      status: 'active',
      current_period_end: '2026-06-01T00:00:00.000Z',
    }, new Date('2026-06-06T00:00:00.000Z'));
    const openPastDue = computeEntitlementsFromSubscription('user-1', {
      plan_code: 'pro',
      status: 'past_due',
    }, new Date('2026-06-06T00:00:00.000Z'));
    const coveredPastDue = computeEntitlementsFromSubscription('user-1', {
      plan_code: 'pro',
      status: 'past_due',
      current_period_end: '2026-06-10T00:00:00.000Z',
    }, new Date('2026-06-06T00:00:00.000Z'));

    expect(expiredActive.has_pro).toBe(false);
    expect(openPastDue.has_pro).toBe(false);
    expect(coveredPastDue.has_pro).toBe(true);
  });

  it('normalizes provider statuses into internal billing states', () => {
    expect(normalizeSubscriptionStatus('past_due')).toBe('past_due');
    expect(normalizeSubscriptionStatus('in_grace_period')).toBe('grace_period');
    expect(normalizeSubscriptionStatus('on_hold')).toBe('account_hold');
    expect(normalizeSubscriptionStatus('unknown')).toBe('expired');
  });
});
