import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';

type SupportRequestListItem = {
  id?: unknown;
  type: 'cancellation' | 'payment_problem';
  status?: unknown;
  billing_provider?: unknown;
  provider_action_status?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  source?: unknown;
  [key: string]: unknown;
};

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('subscription_cancellation_requests')
      .select('id,status,reason_code,billing_provider,source,locale,decision,decision_reason,provider_action_status,created_at,updated_at,resolved_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return apiError(ErrorCode.SUPPORT_UNAVAILABLE, 'SUPPORT_UNAVAILABLE', 500);
    const { data: paymentAlerts } = await admin.from('billing_admin_alerts')
      .select('id,status,provider,severity,created_at,metadata')
      .eq('user_id', user.id)
      .eq('kind', 'payment_failure')
      .order('created_at', { ascending: false })
      .limit(20);
    const cancellationRequests: SupportRequestListItem[] = (data || []).map((request: Record<string, unknown>) => ({
      ...request,
      type: 'cancellation',
    }));
    const paymentRequests: SupportRequestListItem[] = (paymentAlerts || []).map((alert: Record<string, unknown>) => ({
      id: alert.id,
      type: 'payment_problem',
      status: alert.status || 'open',
      billing_provider: alert.provider || null,
      provider_action_status: null,
      created_at: alert.created_at,
      updated_at: alert.created_at,
      source: 'support_chat',
    }));
    const requests = [...cancellationRequests, ...paymentRequests]
      .sort((a, b) => Date.parse(String(b.created_at)) - Date.parse(String(a.created_at)))
      .slice(0, 20);
    return apiSuccess({ requests });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.SUPPORT_UNAVAILABLE, 'SUPPORT_UNAVAILABLE', 500);
  }
}
