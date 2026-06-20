import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const { data, error } = await getSupabaseAdmin().from('subscription_cancellation_requests')
      .select('id,status,reason,billing_provider,source,created_at,updated_at,resolved_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
    return apiSuccess({ requests: data || [] });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to load support requests', 500);
  }
}
