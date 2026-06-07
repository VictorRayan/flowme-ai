export const FREE_AI_CREDITS_PER_DAY = 10;

export const FEATURE_KEYS = [
  'notes',
  'balys_limited',
  'balys_unlimited',
  'calendar',
  'today',
  'goals',
  'finance',
  'reviews',
  'connectors',
  'whatsapp',
  'briefings',
  'reminders',
  'meetings',
  'images',
  'support',
] as const;

export type FeatureKey = typeof FEATURE_KEYS[number];
export type PlanCode = 'free' | 'pro';
export type BillingProvider = 'stripe' | 'apple' | 'google';
export type SubscriptionStatus =
  | 'free'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'grace_period'
  | 'account_hold'
  | 'canceled'
  | 'expired'
  | 'incomplete';

export type FeatureMap = Record<FeatureKey, boolean>;

export interface SubscriptionLike {
  plan_code?: string | null;
  status?: string | null;
  current_period_end?: string | null;
  grace_period_ends_at?: string | null;
}

export interface UserEntitlements {
  user_id: string;
  plan_code: PlanCode;
  has_pro: boolean;
  billing_state: SubscriptionStatus;
  access_until: string | null;
  features: FeatureMap;
  ai_credits: {
    unlimited: boolean;
    daily_limit: number | null;
    label: string;
  };
}

const FREE_FEATURES: FeatureMap = {
  notes: true,
  balys_limited: true,
  support: true,
  balys_unlimited: false,
  calendar: false,
  today: false,
  goals: false,
  finance: false,
  reviews: false,
  connectors: false,
  whatsapp: false,
  briefings: false,
  reminders: false,
  meetings: false,
  images: false,
};

const PRO_FEATURES: FeatureMap = FEATURE_KEYS.reduce((acc, key) => {
  acc[key] = true;
  return acc;
}, {} as FeatureMap);

const ACTIVE_PRO_STATUSES = new Set<SubscriptionStatus>(['trialing', 'active']);
const GRACE_PRO_STATUSES = new Set<SubscriptionStatus>(['past_due', 'grace_period']);

export function normalizeSubscriptionStatus(status: string | null | undefined): SubscriptionStatus {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'in_grace_period') return 'grace_period';
  if (value === 'on_hold') return 'account_hold';
  if (value === 'free' || value === 'trialing' || value === 'active' || value === 'past_due' || value === 'grace_period' || value === 'account_hold' || value === 'canceled' || value === 'expired' || value === 'incomplete') {
    return value;
  }
  return 'expired';
}

export function getDefaultFreeEntitlements(userId: string): UserEntitlements {
  return {
    user_id: userId,
    plan_code: 'free',
    has_pro: false,
    billing_state: 'free',
    access_until: null,
    features: { ...FREE_FEATURES },
    ai_credits: {
      unlimited: false,
      daily_limit: FREE_AI_CREDITS_PER_DAY,
      label: `${FREE_AI_CREDITS_PER_DAY} créditos de IA por dia`,
    },
  };
}

function isFutureDate(value: string | null | undefined, now: Date): boolean {
  if (!value) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && time > now.getTime();
}

function shouldGrantPro(subscription: SubscriptionLike, status: SubscriptionStatus, now: Date): boolean {
  if (subscription.plan_code !== 'pro') return false;
  if (ACTIVE_PRO_STATUSES.has(status)) {
    return !subscription.current_period_end || isFutureDate(subscription.current_period_end, now);
  }
  if (GRACE_PRO_STATUSES.has(status)) {
    return isFutureDate(subscription.grace_period_ends_at || subscription.current_period_end, now);
  }
  return false;
}

export function computeEntitlementsFromSubscription(userId: string, subscription: SubscriptionLike | null, now = new Date()): UserEntitlements {
  if (!subscription) return getDefaultFreeEntitlements(userId);

  const status = normalizeSubscriptionStatus(subscription.status);
  const hasPro = shouldGrantPro(subscription, status, now);
  if (!hasPro) return { ...getDefaultFreeEntitlements(userId), billing_state: status };

  return {
    user_id: userId,
    plan_code: 'pro',
    has_pro: true,
    billing_state: status,
    access_until: subscription.grace_period_ends_at || subscription.current_period_end || null,
    features: { ...PRO_FEATURES },
    ai_credits: {
      unlimited: true,
      daily_limit: null,
      label: 'Créditos de IA ilimitados',
    },
  };
}

export function isFeatureAllowed(entitlements: Pick<UserEntitlements, 'features'>, feature: FeatureKey): boolean {
  return entitlements.features[feature] === true;
}
