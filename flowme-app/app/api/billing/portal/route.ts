import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { appBaseUrl, getStripeClient } from '@/lib/billing/stripe-adapter';

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('provider_customer_id')
      .eq('user_id', user.id)
      .eq('billing_provider', 'stripe')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
    if (!data?.provider_customer_id) return apiError(ErrorCode.VALIDATION_ERROR, 'No Stripe customer found', 400);

    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: data.provider_customer_id,
      return_url: `${appBaseUrl(req.url)}/app/settings?billing=portal_return`,
    });

    return apiSuccess({ url: session.url });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    const message = err instanceof Error ? err.message : 'Failed to create billing portal session';
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}
