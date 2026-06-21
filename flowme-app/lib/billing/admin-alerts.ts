import type { SupabaseClient } from '@supabase/supabase-js';

export async function recordBillingAdminAlert(
  admin: SupabaseClient,
  input: {
    kind: 'webhook_failure' | 'subscription_mismatch' | 'high_ai_cost' | 'cancellation_request' | 'payment_failure';
    severity?: 'info' | 'warning' | 'critical';
    userId?: string | null;
    provider?: 'stripe' | 'asaas' | 'apple' | 'google' | null;
    dedupeKey?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  try {
    const { error } = await admin.from('billing_admin_alerts').upsert({
      kind: input.kind,
      severity: input.severity || 'warning',
      user_id: input.userId || null,
      provider: input.provider || null,
      status: 'open',
      dedupe_key: input.dedupeKey || null,
      metadata: input.metadata || {},
    }, { onConflict: 'dedupe_key' });
    if (error) console.error('[billing-alert] failed:', error.message);
  } catch (error) {
    console.error('[billing-alert] failed:', error);
  }
}

export async function resolvePaymentFailureAdminAlerts(admin: SupabaseClient, userId: string) {
  const { error } = await admin.from('billing_admin_alerts').update({
    status: 'resolved',
    resolved_at: new Date().toISOString(),
  }).eq('kind', 'payment_failure').eq('user_id', userId).eq('status', 'open');
  if (error) console.error('[billing-alert] recovery update failed:', error.message);
}
