import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { verifySignedMarketingToken } from '@/lib/marketing/signed-token';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const payload = verifySignedMarketingToken(token, 'public_checkout');
  if (!payload) return apiError(ErrorCode.UNAUTHORIZED, 'Checkout token is invalid or expired', 401);

  const { data, error } = await getSupabaseAdmin().from('public_checkout_sessions')
    .select('id,email,status,provider,payment_method,plan_code,billing_interval,amount_cents,currency,expires_at,paid_at,claimed_at,updated_at')
    .eq('id', payload.id)
    .eq('email', payload.email)
    .maybeSingle();
  if (error) return apiError(ErrorCode.SUPABASE_ERROR, 'Unable to load public checkout status', 500);
  if (!data) return apiError(ErrorCode.NOT_FOUND, 'Checkout not found', 404);
  return apiSuccess({ checkout: data });
}
