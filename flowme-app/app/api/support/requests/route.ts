import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const { data, error } = await getSupabaseAdmin().from('subscription_cancellation_requests')
      .select('id,status,reason_code,billing_provider,source,locale,decision,decision_reason,provider_action_status,created_at,updated_at,resolved_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return apiError(ErrorCode.SUPPORT_UNAVAILABLE, 'SUPPORT_UNAVAILABLE', 500);
    return apiSuccess({ requests: data || [] });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.SUPPORT_UNAVAILABLE, 'SUPPORT_UNAVAILABLE', 500);
  }
}
