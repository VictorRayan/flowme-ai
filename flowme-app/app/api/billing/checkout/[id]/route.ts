import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAuth(req);
    const { id } = await params;
    const { data, error } = await getSupabaseAdmin().from('billing_checkout_attempts')
      .select('id,status,provider,payment_method,plan_code,billing_interval,amount_cents,currency,expires_at,paid_at,updated_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) return apiError(ErrorCode.SUPABASE_ERROR, 'Unable to load checkout status', 500);
    if (!data) return apiError(ErrorCode.NOT_FOUND, 'Checkout not found', 404);
    return apiSuccess({ checkout: data });
  } catch (error) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Unable to load checkout status', 500);
  }
}
