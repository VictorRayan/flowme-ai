import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { computeEntitlementsFromSubscription } from '@/lib/billing/entitlements';
import { getStripeClient, stripeSubscriptionToRow } from '@/lib/billing/stripe-adapter';
import { recordBillingAdminAlert, resolvePaymentFailureAdminAlerts } from '@/lib/billing/admin-alerts';
import {
  clearBillingFailureNotifications,
  createBillingNotification,
  type BillingNotificationKind,
} from '@/lib/billing/notifications';

type StripeInvoiceObject = {
  id: string;
  customer?: string | { id?: string } | null;
  subscription?: string | { id?: string } | null;
  metadata?: Record<string, string> | null;
  parent?: { subscription_details?: { subscription?: string | { id?: string } | null } | null } | null;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('Supabase admin credentials missing');
  return createClient(url, serviceRoleKey);
}

async function persistSubscription(admin: any, row: ReturnType<typeof stripeSubscriptionToRow>) {
  if (!row.user_id) throw new Error('Unable to resolve user for Stripe subscription');
  const { error } = await admin.from('user_subscriptions').upsert(row, {
    onConflict: 'billing_provider,provider_subscription_id',
  });
  if (error) throw new Error(error.message);

  const entitlements = computeEntitlementsFromSubscription(row.user_id, row);
  const { error: entitlementsError } = await admin.from('user_entitlements').upsert({
    user_id: row.user_id,
    plan_code: entitlements.plan_code,
    has_pro: entitlements.has_pro,
    billing_state: entitlements.billing_state,
    access_until: entitlements.access_until,
    features: entitlements.features,
    ai_credits: entitlements.ai_credits,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (entitlementsError) throw new Error(entitlementsError.message);
}

async function recordEvent(admin: any, event: Stripe.Event): Promise<boolean> {
  const object: any = event.data.object || {};
  const { error } = await admin.from('billing_events').insert({
    provider: 'stripe',
    event_id: event.id,
    event_type: event.type,
    user_id: object.metadata?.user_id || null,
    provider_customer_id: typeof object.customer === 'string' ? object.customer : object.customer?.id || null,
    provider_subscription_id: typeof object.subscription === 'string' ? object.subscription : object.id?.startsWith?.('sub_') ? object.id : null,
    payload: event as any,
  });
  if (!error) return true;
  if (error.code === '23505') {
    const { data, error: lookupError } = await admin
      .from('billing_events')
      .select('processed_at')
      .eq('provider', 'stripe')
      .eq('event_id', event.id)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    return !data?.processed_at;
  }
  throw new Error(error.message);
}

async function markEventProcessed(admin: any, event: Stripe.Event) {
  const { error } = await admin
    .from('billing_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('provider', 'stripe')
    .eq('event_id', event.id);
  if (error) throw new Error(error.message);
}

async function resolveUserId(admin: any, subscription: Stripe.Subscription): Promise<string | null> {
  if (subscription.metadata?.user_id) return subscription.metadata.user_id;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || null;
  if (!customerId) return null;
  const { data } = await admin
    .from('user_subscriptions')
    .select('user_id')
    .eq('billing_provider', 'stripe')
    .eq('provider_customer_id', customerId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.user_id || null;
}

function invoiceSubscriptionId(invoice: StripeInvoiceObject): string | null {
  const subscription = invoice.subscription || invoice.parent?.subscription_details?.subscription;
  return typeof subscription === 'string' ? subscription : subscription?.id || null;
}

async function resolveInvoiceContext(admin: any, invoice: StripeInvoiceObject) {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (subscriptionId) {
    const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
    const userId = await resolveUserId(admin, subscription);
    if (userId) await persistSubscription(admin, stripeSubscriptionToRow(subscription, userId));
    return { userId, subscriptionId };
  }
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || null;
  if (!customerId) return { userId: invoice.metadata?.user_id || null, subscriptionId: null };
  const { data, error } = await admin.from('user_subscriptions')
    .select('user_id,provider_subscription_id')
    .eq('billing_provider', 'stripe')
    .eq('provider_customer_id', customerId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { userId: data?.user_id || invoice.metadata?.user_id || null, subscriptionId: data?.provider_subscription_id || null };
}

async function notifyInvoiceFailure(
  admin: any,
  invoice: StripeInvoiceObject,
  kind: BillingNotificationKind,
) {
  const context = await resolveInvoiceContext(admin, invoice);
  if (!context.userId) throw new Error('Unable to resolve user for Stripe invoice');
  await createBillingNotification(admin, {
    userId: context.userId,
    kind,
    provider: 'stripe',
    metadata: { invoice_id: invoice.id, provider_subscription_id: context.subscriptionId },
  });
  await recordBillingAdminAlert(admin, {
    kind: 'payment_failure',
    severity: kind === 'payment_failed' ? 'critical' : 'warning',
    userId: context.userId,
    provider: 'stripe',
    dedupeKey: `stripe-invoice:${invoice.id}:${kind}`,
    metadata: { invoice_id: invoice.id, event_kind: kind },
  });
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return NextResponse.json({ ok: false, error: 'STRIPE_WEBHOOK_SECRET not configured' }, { status: 500 });

  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ ok: false, error: 'missing stripe-signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid signature';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  try {
    const admin = adminClient();
    const firstSeen = await recordEvent(admin, event);
    if (!firstSeen) return NextResponse.json({ ok: true, duplicate: true });

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (typeof session.subscription === 'string') {
        const subscription = await getStripeClient().subscriptions.retrieve(session.subscription);
        await persistSubscription(admin, stripeSubscriptionToRow(subscription, session.metadata?.user_id || session.client_reference_id || null));
      }
    }

    if (
      event.type === 'customer.subscription.created'
      || event.type === 'customer.subscription.updated'
      || event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      await persistSubscription(admin, stripeSubscriptionToRow(subscription, await resolveUserId(admin, subscription)));
    }

    if (event.type === 'invoice.payment_failed') {
      await notifyInvoiceFailure(admin, event.data.object as unknown as StripeInvoiceObject, 'payment_failed');
    }

    if (event.type === 'invoice.payment_action_required') {
      await notifyInvoiceFailure(admin, event.data.object as unknown as StripeInvoiceObject, 'payment_action_required');
    }

    if (event.type === 'invoice.finalization_failed') {
      await notifyInvoiceFailure(admin, event.data.object as unknown as StripeInvoiceObject, 'invoice_finalization_failed');
    }

    if (event.type === 'invoice.paid') {
      const context = await resolveInvoiceContext(admin, event.data.object as unknown as StripeInvoiceObject);
      if (context.userId) {
        await clearBillingFailureNotifications(admin, context.userId);
        await resolvePaymentFailureAdminAlerts(admin, context.userId);
      }
    }

    await markEventProcessed(admin, event);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process Stripe webhook';
    console.error('[stripe-webhook] failed:', error);
    await recordBillingAdminAlert(adminClient(), {
      kind: 'webhook_failure', severity: 'critical', provider: 'stripe',
      dedupeKey: `stripe-webhook:${event.id}`,
      metadata: { event_id: event.id, event_type: event.type, error: message },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
