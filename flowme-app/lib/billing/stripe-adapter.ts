import Stripe from 'stripe';
import { SubscriptionStatus } from './entitlements';

export type BillingInterval = 'monthly' | 'annual';

export function stripePriceEnvName(interval: BillingInterval): string {
  return interval === 'monthly' ? 'STRIPE_PRO_MONTHLY_PRICE_ID' : 'STRIPE_PRO_ANNUAL_PRICE_ID';
}

export function stripePriceIdForInterval(interval: BillingInterval): string {
  const envName = stripePriceEnvName(interval);
  const value = process.env[envName];
  if (!value) throw new Error(`${envName} is not configured`);
  return value;
}

export function configuredStripeProPriceIds(): string[] {
  return [
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
  ].filter((value): value is string => Boolean(value));
}

export function assertStripeProPrice(priceId: string | null | undefined): string {
  if (!priceId) throw new Error('Stripe subscription price is missing');
  const configured = configuredStripeProPriceIds();
  if (configured.length === 0) throw new Error('Stripe Pro price IDs are not configured');
  if (!configured.includes(priceId)) throw new Error(`Stripe subscription price is not configured for Pro: ${priceId}`);
  return priceId;
}

export function normalizeBillingInterval(value: unknown): BillingInterval | null {
  return value === 'monthly' || value === 'annual' ? value : null;
}

export function getStripeClient(): Stripe {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(apiKey);
}

export function appBaseUrl(requestUrl?: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (requestUrl) {
    const url = new URL(requestUrl);
    return `${url.protocol}//${url.host}`;
  }
  return 'http://localhost:3000';
}

export function normalizeStripeSubscriptionStatus(status: string): SubscriptionStatus {
  if (status === 'trialing') return 'trialing';
  if (status === 'active') return 'active';
  if (status === 'past_due' || status === 'unpaid') return 'past_due';
  if (status === 'canceled') return 'canceled';
  if (status === 'incomplete') return 'incomplete';
  if (status === 'incomplete_expired') return 'expired';
  return 'expired';
}

function fromUnix(value: number | null | undefined): string | null {
  return value ? new Date(value * 1000).toISOString() : null;
}

export function stripeSubscriptionToRow(subscription: Stripe.Subscription, userId?: string | null) {
  const raw = subscription as any;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || null;
  const metadataUserId = subscription.metadata?.user_id || userId || null;
  const priceId = assertStripeProPrice(subscription.items.data[0]?.price?.id || null);
  return {
    user_id: metadataUserId,
    plan_code: 'pro',
    billing_provider: 'stripe',
    provider_customer_id: customerId,
    provider_subscription_id: subscription.id,
    status: normalizeStripeSubscriptionStatus(subscription.status),
    current_period_start: fromUnix(raw.current_period_start),
    current_period_end: fromUnix(raw.current_period_end),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    last_payment_failure_at: subscription.status === 'past_due' || subscription.status === 'unpaid'
      ? new Date().toISOString()
      : null,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {
      stripe_status: subscription.status,
      price_id: priceId,
    },
  };
}
