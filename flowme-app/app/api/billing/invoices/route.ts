import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { logSupabaseRouteError } from '@/lib/api/supabase-error-log';
import { getStripeClient } from '@/lib/billing/stripe-adapter';

export async function GET(req: NextRequest) {
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

    if (error) {
      logSupabaseRouteError('/api/billing/invoices', 'user_subscriptions', error);
      return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
    }
    if (!data?.provider_customer_id) return apiSuccess({ invoices: [] });

    const stripe = getStripeClient();
    const invoices = await stripe.invoices.list({
      customer: data.provider_customer_id,
      limit: 12,
    });

    return apiSuccess({
      invoices: invoices.data.map(invoice => ({
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        currency: invoice.currency?.toUpperCase(),
        amount_paid: invoice.amount_paid,
        amount_due: invoice.amount_due,
        created: invoice.created ? new Date(invoice.created * 1000).toISOString() : null,
        hosted_invoice_url: invoice.hosted_invoice_url,
        invoice_pdf: invoice.invoice_pdf,
      })),
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    const message = err instanceof Error ? err.message : 'Failed to load invoices';
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}
