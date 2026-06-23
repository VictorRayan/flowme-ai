import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { requireManagementRole } from '@/lib/billing/admin-auth';

export async function GET(req: NextRequest) {
  try {
    await requireManagementRole(req, ['support_manager', 'billing_manager', 'admin']);
    const status = req.nextUrl.searchParams.get('status');
    let query = getSupabaseAdmin().from('subscription_cancellation_requests')
      .select('id,user_id,subscription_id,billing_provider,status,reason_code,reason,disappointing_features,unmet_expectation,would_accept_human_support,locale,assigned_to,admin_notes,decision,decision_reason,decided_by,decided_at,provider_action_status,provider_action_error,created_at,updated_at,resolved_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) return apiError(ErrorCode.SUPABASE_ERROR, 'CANCELLATION_MANAGEMENT_LOAD_FAILED', 500);
    return apiSuccess({ requests: data || [] });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    if (error instanceof Error && error.message === 'FORBIDDEN') return apiError(ErrorCode.UNAUTHORIZED, 'Forbidden', 403);
    return apiError(ErrorCode.INTERNAL_ERROR, 'CANCELLATION_MANAGEMENT_LOAD_FAILED', 500);
  }
}
