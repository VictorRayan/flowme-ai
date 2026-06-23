import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { computeEntitlementsFromSubscription } from '@/lib/billing/entitlements';
import { asaasPeriodEnd, normalizeAsaasEvent, verifyAsaasWebhookToken } from '@/lib/billing/providers/asaas-events';
import { recordBillingAdminAlert } from '@/lib/billing/admin-alerts';
import { clearBillingFailureNotifications, createBillingNotification } from '@/lib/billing/notifications';

type CheckoutAttempt = {
  id: string;
  user_id: string;
  plan_code: string;
  billing_interval: 'monthly' | 'annual';
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  last_provider_event_at: string | null;
};

function eventIsOlder(occurredAt: string, lastEventAt: string | null): boolean {
  return Boolean(lastEventAt && Date.parse(occurredAt) <= Date.parse(lastEventAt));
}

export async function POST(req: NextRequest) {
  const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!webhookToken) return NextResponse.json({ ok: false, error: 'Asaas webhook is not configured' }, { status: 500 });
  if (!verifyAsaasWebhookToken(req.headers.get('asaas-access-token'), webhookToken)) {
    return NextResponse.json({ ok: false, error: 'Invalid webhook token' }, { status: 401 });
  }

  let event: ReturnType<typeof normalizeAsaasEvent>;
  try {
    event = normalizeAsaasEvent(await req.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid webhook payload' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const processingStartedAt = new Date().toISOString();
  const { error: insertError } = await admin.from('billing_events').insert({
    provider: 'asaas',
    event_id: event.id,
    event_type: event.type,
    provider_customer_id: event.customerId,
    provider_subscription_id: event.subscriptionId,
    payload: event.raw,
    processing_started_at: processingStartedAt,
  });
  if (insertError?.code === '23505') {
    const { data: existing } = await admin.from('billing_events')
      .select('processed_at,processing_started_at')
      .eq('provider', 'asaas')
      .eq('event_id', event.id)
      .maybeSingle();
    if (existing?.processed_at) return NextResponse.json({ ok: true, duplicate: true });
    const started = existing?.processing_started_at ? Date.parse(existing.processing_started_at) : 0;
    if (started > Date.now() - 5 * 60_000) return NextResponse.json({ ok: true, duplicate: true });
    const { error: claimError } = await admin.from('billing_events')
      .update({ processing_started_at: processingStartedAt })
      .eq('provider', 'asaas')
      .eq('event_id', event.id)
      .is('processed_at', null);
    if (claimError) return NextResponse.json({ ok: false, error: 'Unable to claim webhook event' }, { status: 500 });
  } else if (insertError) {
    return NextResponse.json({ ok: false, error: 'Unable to persist webhook event' }, { status: 500 });
  }

  try {
    let attempt: CheckoutAttempt | null = null;
    if (event.externalReference) {
      const { data } = await admin.from('billing_checkout_attempts')
        .select('id,user_id,plan_code,billing_interval,provider_customer_id,provider_subscription_id,last_provider_event_at')
        .eq('id', event.externalReference)
        .eq('provider', 'asaas')
        .maybeSingle();
      attempt = data as CheckoutAttempt | null;
    }
    if (!attempt && event.subscriptionId) {
      const { data } = await admin.from('billing_checkout_attempts')
        .select('id,user_id,plan_code,billing_interval,provider_customer_id,provider_subscription_id,last_provider_event_at')
        .eq('provider', 'asaas')
        .eq('provider_subscription_id', event.subscriptionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      attempt = data as CheckoutAttempt | null;
    }

    if (attempt && !eventIsOlder(event.occurredAt, attempt.last_provider_event_at)) {
      if (event.attemptStatus) {
        await admin.from('billing_checkout_attempts').update({
          status: event.attemptStatus,
          provider_payment_id: event.paymentId,
          provider_customer_id: event.customerId || attempt.provider_customer_id,
          provider_subscription_id: event.subscriptionId || attempt.provider_subscription_id,
          paid_at: event.attemptStatus === 'paid' ? event.occurredAt : undefined,
          last_provider_event_at: event.occurredAt,
          updated_at: new Date().toISOString(),
        }).eq('id', attempt.id);
      }

      if (event.status && event.subscriptionId) {
        const row = {
          user_id: attempt.user_id,
          plan_code: attempt.plan_code,
          billing_provider: 'asaas',
          provider_customer_id: event.customerId || attempt.provider_customer_id,
          provider_subscription_id: event.subscriptionId,
          status: event.status,
          current_period_start: event.paymentDate || event.occurredAt,
          current_period_end: asaasPeriodEnd(event.paymentDate || event.occurredAt, attempt.billing_interval),
          cancel_at_period_end: false,
          last_payment_failure_at: event.status === 'past_due' ? event.occurredAt : null,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: { last_asaas_event: event.type, last_payment_id: event.paymentId },
        };
        const conflict = row.provider_customer_id ? 'billing_provider,provider_customer_id' : 'billing_provider,provider_subscription_id';
        const { error: subscriptionError } = await admin.from('user_subscriptions').upsert(row, { onConflict: conflict });
        if (subscriptionError) throw new Error(subscriptionError.message);

        const entitlements = computeEntitlementsFromSubscription(attempt.user_id, row);
        const { error: entitlementError } = await admin.from('user_entitlements').upsert({
          user_id: attempt.user_id,
          plan_code: entitlements.plan_code,
          has_pro: entitlements.has_pro,
          billing_state: entitlements.billing_state,
          access_until: entitlements.access_until,
          features: entitlements.features,
          ai_credits: entitlements.ai_credits,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        if (entitlementError) throw new Error(entitlementError.message);

        if (event.status === 'past_due') {
          await createBillingNotification(admin, {
            userId: attempt.user_id,
            kind: 'payment_failed',
            provider: 'asaas',
            metadata: { provider_subscription_id: event.subscriptionId, payment_id: event.paymentId },
          });
          await recordBillingAdminAlert(admin, {
            kind: 'payment_failure',
            severity: 'warning',
            userId: attempt.user_id,
            provider: 'asaas',
            dedupeKey: `asaas-payment:${event.paymentId}:overdue`,
            metadata: { payment_id: event.paymentId, provider_subscription_id: event.subscriptionId },
          });
        } else if (event.status === 'active') {
          await clearBillingFailureNotifications(admin, attempt.user_id);
        }
      }

      if (event.amountCents !== null && ['PAYMENT_RECEIVED', 'PAYMENT_REFUNDED', 'PAYMENT_PARTIALLY_REFUNDED'].includes(event.type)) {
        await admin.from('billing_revenue_events').upsert({
          user_id: attempt.user_id,
          provider: 'asaas',
          provider_event_id: event.id,
          kind: event.type === 'PAYMENT_RECEIVED' ? 'payment_received' : 'refund',
          currency: event.currency,
          amount_cents: event.type === 'PAYMENT_RECEIVED' ? event.amountCents : -event.amountCents,
          occurred_at: event.occurredAt,
        }, { onConflict: 'provider,provider_event_id,kind' });
      }
    }

    await admin.from('billing_events').update({ processed_at: new Date().toISOString() })
      .eq('provider', 'asaas')
      .eq('event_id', event.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process Asaas event';
    await recordBillingAdminAlert(admin, {
      kind: 'webhook_failure',
      severity: 'critical',
      provider: 'asaas',
      dedupeKey: `asaas-webhook:${event.id}`,
      metadata: { event_id: event.id, event_type: event.type, error: message },
    });
    return NextResponse.json({ ok: false, error: 'Unable to process webhook event' }, { status: 500 });
  }
}
