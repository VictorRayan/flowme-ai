import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { computeEntitlementsFromSubscription } from '@/lib/billing/entitlements';
import { getStripeClient, stripeSubscriptionToRow } from '@/lib/billing/stripe-adapter';
import { sendPublicCheckoutPurchase } from '@/lib/meta/purchase';
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
  amount_paid?: number;
  currency?: string;
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
    return {
      userId,
      subscriptionId,
      attemptId: subscription.metadata?.checkout_attempt_id || null,
      publicSessionId: subscription.metadata?.public_checkout_session_id || null,
    };
  }
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || null;
  if (!customerId) return { userId: invoice.metadata?.user_id || null, subscriptionId: null, attemptId: null, publicSessionId: null };
  const { data, error } = await admin.from('user_subscriptions')
    .select('user_id,provider_subscription_id')
    .eq('billing_provider', 'stripe')
    .eq('provider_customer_id', customerId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { userId: data?.user_id || invoice.metadata?.user_id || null, subscriptionId: data?.provider_subscription_id || null, attemptId: null, publicSessionId: null };
}

async function updateStripeAttempt(admin: any, attemptId: string | null | undefined, values: Record<string, unknown>) {
  if (!attemptId) return;
  const { error } = await admin.from('billing_checkout_attempts').update({
    ...values,
    updated_at: new Date().toISOString(),
  }).eq('id', attemptId).eq('provider', 'stripe');
  if (error) throw new Error(error.message);
}

async function updatePublicStripeSession(admin: any, sessionId: string | null | undefined, values: Record<string, unknown>) {
  if (!sessionId) return;
  const { error } = await admin.from('public_checkout_sessions').update({
    ...values,
    updated_at: new Date().toISOString(),
  }).eq('id', sessionId).eq('provider', 'stripe');
  if (error) throw new Error(error.message);
}

async function notifyInvoiceFailure(
  admin: any,
  invoice: StripeInvoiceObject,
  kind: BillingNotificationKind,
) {
  const context = await resolveInvoiceContext(admin, invoice);
  if (context.publicSessionId) {
    await updatePublicStripeSession(admin, context.publicSessionId, { status: 'failed' });
    return;
  }
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
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null;
      await updateStripeAttempt(admin, session.metadata?.checkout_attempt_id, {
        status: 'awaiting_payment',
        provider_subscription_id: subscriptionId,
        provider_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
      });
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      if (subscription.metadata?.public_checkout_session_id) {
        await updatePublicStripeSession(admin, subscription.metadata.public_checkout_session_id, { status: 'canceled', provider_subscription_id: subscription.id });
      } else {
        await persistSubscription(admin, stripeSubscriptionToRow(subscription, await resolveUserId(admin, subscription)));
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        if (subscription.metadata?.public_checkout_session_id) {
          await updatePublicStripeSession(admin, subscription.metadata.public_checkout_session_id, {
            status: subscription.status === 'past_due' ? 'past_due' : subscription.status === 'canceled' ? 'canceled' : 'failed',
            provider_subscription_id: subscription.id,
          });
        } else {
          await persistSubscription(admin, stripeSubscriptionToRow(subscription, await resolveUserId(admin, subscription)));
        }
      }
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
      const invoice = event.data.object as unknown as StripeInvoiceObject;
      const context = await resolveInvoiceContext(admin, invoice);
      if (context.publicSessionId) {
        await updatePublicStripeSession(admin, context.publicSessionId, {
          status: 'paid',
          paid_at: new Date().toISOString(),
          provider_subscription_id: context.subscriptionId,
        });
        if (typeof invoice.amount_paid === 'number' && invoice.currency) {
          await admin.from('billing_revenue_events').upsert({
            user_id: null, provider: 'stripe', provider_event_id: event.id, kind: 'payment_received',
            currency: invoice.currency.toUpperCase(), amount_cents: invoice.amount_paid, occurred_at: new Date(event.created * 1000).toISOString(),
          }, { onConflict: 'provider,provider_event_id,kind' });
        }
        void sendPublicCheckoutPurchase(admin, context.publicSessionId)
          .catch(err => console.error('[meta/capi] stripe purchase dispatch failed', err));
      } else if (context.userId) {
        await updateStripeAttempt(admin, context.attemptId, { status: 'paid', paid_at: new Date().toISOString() });
        await clearBillingFailureNotifications(admin, context.userId);
        await resolvePaymentFailureAdminAlerts(admin, context.userId);
        if (typeof invoice.amount_paid === 'number' && invoice.currency) {
          await admin.from('billing_revenue_events').upsert({
            user_id: context.userId, provider: 'stripe', provider_event_id: event.id, kind: 'payment_received',
            currency: invoice.currency.toUpperCase(), amount_cents: invoice.amount_paid, occurred_at: new Date(event.created * 1000).toISOString(),
          }, { onConflict: 'provider,provider_event_id,kind' });
        }
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
