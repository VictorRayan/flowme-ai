import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import {
  appBaseUrl,
  getStripeClient,
  normalizeBillingInterval,
  stripePriceIdForInterval,
} from '@/lib/billing/stripe-adapter';

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const interval = normalizeBillingInterval(body.interval || 'monthly');
    if (!interval) return apiError(ErrorCode.VALIDATION_ERROR, 'interval must be monthly or annual', 400);

    const price = stripePriceIdForInterval(interval);
    const stripe = getStripeClient();
    const { data: existing } = await supabase
      .from('user_subscriptions')
      .select('provider_customer_id')
      .eq('user_id', user.id)
      .eq('billing_provider', 'stripe')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let customerId = existing?.provider_customer_id || null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      const { error } = await supabase.from('user_subscriptions').upsert({
        user_id: user.id,
        plan_code: 'pro',
        billing_provider: 'stripe',
        provider_customer_id: customerId,
        status: 'incomplete',
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'billing_provider,provider_customer_id' });
      if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
    }

    const base = appBaseUrl(req.url);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      success_url: `${base}/app/settings?billing=success`,
      cancel_url: `${base}/app/settings?billing=cancelled`,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        plan_code: 'pro',
        billing_interval: interval,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_code: 'pro',
          billing_interval: interval,
        },
      },
    });

    return apiSuccess({ url: session.url });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    const message = err instanceof Error ? err.message : 'Failed to create checkout session';
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}
