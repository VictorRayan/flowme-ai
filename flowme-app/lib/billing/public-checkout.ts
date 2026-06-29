import { computeEntitlementsFromSubscription } from '@/lib/billing/entitlements';

type SupabaseAdmin = {
  from(table: string): any;
};

export function publicCheckoutPeriodEnd(paidAt: string, interval: 'monthly' | 'annual') {
  const date = new Date(paidAt);
  if (interval === 'annual') date.setFullYear(date.getFullYear() + 1);
  else date.setMonth(date.getMonth() + 1);
  return date.toISOString();
}

export async function claimPublicCheckoutForUser(admin: SupabaseAdmin, input: { tokenSessionId: string; userId: string; userEmail: string }) {
  const { data: session, error } = await admin.from('public_checkout_sessions')
    .select('id,email,plan_code,provider,provider_customer_id,provider_subscription_id,provider_payment_id,billing_interval,status,paid_at,currency,amount_cents,metadata')
    .eq('id', input.tokenSessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!session) return { ok: false as const, reason: 'not_found' as const, email: null };

  const expectedEmail = String(session.email || '').trim().toLowerCase();
  const actualEmail = input.userEmail.trim().toLowerCase();
  if (expectedEmail !== actualEmail) return { ok: false as const, reason: 'email_mismatch' as const, email: expectedEmail };
  if (session.status !== 'paid' && session.status !== 'claimed') return { ok: false as const, reason: 'not_paid' as const, email: expectedEmail };

  const paidAt = session.paid_at || new Date().toISOString();
  const subscriptionRow = {
    user_id: input.userId,
    plan_code: session.plan_code,
    billing_provider: session.provider,
    provider_customer_id: session.provider_customer_id,
    provider_subscription_id: session.provider_subscription_id || session.provider_payment_id || session.id,
    status: 'active',
    current_period_start: paidAt,
    current_period_end: publicCheckoutPeriodEnd(paidAt, session.billing_interval),
    cancel_at_period_end: false,
    last_payment_failure_at: null,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {
      ...(session.metadata || {}),
      public_checkout_session_id: session.id,
      provider_payment_id: session.provider_payment_id,
    },
  };

  const { error: subscriptionError } = await admin.from('user_subscriptions').upsert(subscriptionRow, {
    onConflict: 'billing_provider,provider_subscription_id',
  });
  if (subscriptionError) throw new Error(subscriptionError.message);

  const entitlements = computeEntitlementsFromSubscription(input.userId, subscriptionRow);
  const { error: entitlementError } = await admin.from('user_entitlements').upsert({
    user_id: input.userId,
    plan_code: entitlements.plan_code,
    has_pro: entitlements.has_pro,
    billing_state: entitlements.billing_state,
    access_until: entitlements.access_until,
    features: entitlements.features,
    ai_credits: entitlements.ai_credits,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (entitlementError) throw new Error(entitlementError.message);

  const { error: updateError } = await admin.from('public_checkout_sessions').update({
    status: 'claimed',
    claimed_user_id: input.userId,
    claimed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', session.id);
  if (updateError) throw new Error(updateError.message);

  return { ok: true as const, email: expectedEmail };
}
