import { computeEntitlementsFromSubscription } from './entitlements';
import { fetchAppleSubscription, fetchGoogleSubscription, syncVerifiedMobileSubscription } from './mobile-subscriptions';
import { getStripeClient, stripeSubscriptionToRow } from './stripe-adapter';

type LocalSubscription = {
  id: string;
  user_id: string;
  billing_provider: 'stripe' | 'asaas' | 'apple' | 'google';
  provider_subscription_id: string | null;
  provider_original_transaction_id: string | null;
  provider_purchase_token: string | null;
  status: string;
  current_period_end: string | null;
  metadata: Record<string, unknown> | null;
};

export async function reconcileBilling(admin: any) {
  const { data: run, error: runError } = await admin.from('billing_reconciliation_runs')
    .insert({ status: 'running' }).select('id').single();
  if (runError || !run) throw new Error(runError?.message || 'Failed to start reconciliation');
  const { data: subscriptions, error } = await admin.from('user_subscriptions')
    .select('id,user_id,billing_provider,provider_subscription_id,provider_original_transaction_id,provider_purchase_token,status,current_period_end,metadata')
    .neq('status', 'free');
  if (error) throw new Error(error.message);

  let matched = 0;
  let repaired = 0;
  let mismatched = 0;
  for (const local of (subscriptions || []) as LocalSubscription[]) {
    try {
      let providerStatus = local.status;
      let providerEnd = local.current_period_end;
      if (local.billing_provider === 'stripe' && local.provider_subscription_id) {
        const subscription = await getStripeClient().subscriptions.retrieve(local.provider_subscription_id);
        const row = stripeSubscriptionToRow(subscription, local.user_id);
        providerStatus = row.status;
        providerEnd = row.current_period_end;
        if (providerStatus !== local.status || providerEnd !== local.current_period_end) {
          await admin.from('user_subscriptions').update(row).eq('id', local.id);
          const entitlements = computeEntitlementsFromSubscription(local.user_id, row);
          await admin.from('user_entitlements').upsert({ ...entitlements, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
          repaired++;
        }
      } else if (local.billing_provider === 'apple' && local.provider_original_transaction_id) {
        const environment = local.metadata?.environment === 'Sandbox' ? 'Sandbox' : 'Production';
        const verified = await fetchAppleSubscription(local.provider_original_transaction_id, local.user_id, environment);
        providerStatus = verified.status;
        providerEnd = verified.currentPeriodEnd;
        if (providerStatus !== local.status || providerEnd !== local.current_period_end) {
          await syncVerifiedMobileSubscription(admin, local.user_id, verified);
          repaired++;
        }
      } else if (local.billing_provider === 'google' && local.provider_purchase_token) {
        const verified = await fetchGoogleSubscription(local.provider_purchase_token, local.user_id);
        providerStatus = verified.status;
        providerEnd = verified.currentPeriodEnd;
        if (providerStatus !== local.status || providerEnd !== local.current_period_end) {
          await syncVerifiedMobileSubscription(admin, local.user_id, verified);
          repaired++;
        }
      }
      if (providerStatus === local.status && providerEnd === local.current_period_end) matched++;
      else {
        mismatched++;
        await admin.from('billing_reconciliation_issues').insert({
          run_id: run.id, user_id: local.user_id, provider: local.billing_provider, subscription_id: local.id,
          issue_type: 'state_mismatch', local_state: { status: local.status, current_period_end: local.current_period_end },
          provider_state: { status: providerStatus, current_period_end: providerEnd }, repaired: true,
        });
      }
    } catch (reconcileError) {
      mismatched++;
      await admin.from('billing_admin_alerts').upsert({
        kind: 'subscription_mismatch', severity: 'critical', user_id: local.user_id, provider: local.billing_provider,
        status: 'open', dedupe_key: `reconcile:${local.billing_provider}:${local.id}`,
        metadata: { subscription_id: local.id, error: reconcileError instanceof Error ? reconcileError.message : 'unknown' },
      }, { onConflict: 'dedupe_key' });
    }
  }
  const summary = { inspected: subscriptions?.length || 0, matched, repaired, mismatched };
  await admin.from('billing_reconciliation_runs').update({ ...summary, status: 'completed', completed_at: new Date().toISOString() }).eq('id', run.id);
  return summary;
}

export async function createHighAiCostAlerts(admin: any, now = new Date()) {
  const start = new Date(now); start.setUTCHours(0, 0, 0, 0);
  const threshold = Number(process.env.DAILY_AI_COST_ALERT_USD || 5);
  const { data, error } = await admin.from('ai_usage_logs').select('user_id,cost_usd').gte('created_at', start.toISOString());
  if (error) throw new Error(error.message);
  const totals = new Map<string, number>();
  for (const row of data || []) totals.set(row.user_id, (totals.get(row.user_id) || 0) + Number(row.cost_usd || 0));
  let alerts = 0;
  for (const [userId, costUsd] of totals) {
    if (costUsd < threshold) continue;
    await admin.from('billing_admin_alerts').upsert({
      kind: 'high_ai_cost', severity: 'warning', user_id: userId, status: 'open',
      dedupe_key: `high_ai_cost:${start.toISOString().slice(0, 10)}:${userId}`, metadata: { cost_usd: costUsd, threshold_usd: threshold },
    }, { onConflict: 'dedupe_key' });
    alerts++;
  }
  return { inspected_users: totals.size, alerts };
}
