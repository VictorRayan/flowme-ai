import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { appBaseUrl, getStripeClient } from '@/lib/billing/stripe-adapter';

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
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
    const returnUrl = `${appBaseUrl(req.url)}/app/settings?billing=portal_return`;
    const session = await stripe.billingPortal.sessions.create({
      customer: data.provider_customer_id,
      return_url: returnUrl,
      flow_data: {
        type: 'payment_method_update',
        after_completion: {
          type: 'redirect',
          redirect: {
            return_url: returnUrl,
          },
        },
      },
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
