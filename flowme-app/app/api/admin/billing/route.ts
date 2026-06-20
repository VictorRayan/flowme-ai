import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { requireBillingAdmin } from '@/lib/billing/admin-auth';

export async function GET(req: NextRequest) {
  try {
    await requireBillingAdmin(req);
    const admin = getSupabaseAdmin();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [alerts, runs, cancellations, usage, subscriptions, entitlements, notifications] = await Promise.all([
      admin.from('billing_admin_alerts').select('id,kind,severity,user_id,provider,status,metadata,created_at').order('created_at', { ascending: false }).limit(100),
      admin.from('billing_reconciliation_runs').select('*').order('started_at', { ascending: false }).limit(20),
      admin.from('subscription_cancellation_requests').select('id,user_id,status,billing_provider,reason,created_at').order('created_at', { ascending: false }).limit(50),
      admin.from('ai_usage_logs').select('user_id,cost_usd,created_at').gte('created_at', since),
      admin.from('user_subscriptions').select('id,user_id,plan_code,billing_provider,status,current_period_end,cancel_at_period_end').order('updated_at', { ascending: false }).limit(100),
      admin.from('user_entitlements').select('user_id,plan_code,has_pro,billing_state,access_until,updated_at').order('updated_at', { ascending: false }).limit(100),
      admin.from('billing_notifications').select('id,user_id,kind,provider,status,channels_attempted,created_at,sent_at').order('created_at', { ascending: false }).limit(100),
    ]);
    const costs = new Map<string, number>();
    for (const row of usage.data || []) costs.set(row.user_id, (costs.get(row.user_id) || 0) + Number(row.cost_usd || 0));
    return apiSuccess({
      alerts: alerts.data || [], runs: runs.data || [], cancellation_requests: cancellations.data || [],
      subscriptions: subscriptions.data || [], entitlements: entitlements.data || [],
      failed_payments: (notifications.data || []).filter(row => row.kind === 'payment_failed' || row.kind === 'payment_action_required'),
      ai_costs: Array.from(costs, ([user_id, cost_usd]) => ({ user_id, cost_usd: Number(cost_usd.toFixed(4)) })).sort((a, b) => b.cost_usd - a.cost_usd),
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    if (error instanceof Error && error.message === 'FORBIDDEN') return apiError(ErrorCode.UNAUTHORIZED, 'Forbidden', 403);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to load billing operations', 500);
  }
}

const CANCELLATION_STATUSES = ['open', 'in_review', 'retained', 'approved_cancel', 'canceled', 'closed'] as const;

export async function PATCH(req: NextRequest) {
  try {
    const { user } = await requireBillingAdmin(req);
    const body = await req.json().catch(() => ({}));
    const requestId = typeof body.request_id === 'string' ? body.request_id.trim() : '';
    const status = typeof body.status === 'string' && CANCELLATION_STATUSES.includes(body.status) ? body.status : '';
    const adminNotes = typeof body.admin_notes === 'string' ? body.admin_notes.trim() : '';
    if (!requestId || !status) return apiError(ErrorCode.VALIDATION_ERROR, 'request_id and a valid status are required', 400);
    if (adminNotes.length > 4000) return apiError(ErrorCode.VALIDATION_ERROR, 'admin_notes must have at most 4000 characters', 400);
    const resolved = ['retained', 'canceled', 'closed'].includes(status);
    const { data, error } = await getSupabaseAdmin().from('subscription_cancellation_requests').update({
      status,
      admin_notes: adminNotes || null,
      assigned_to: user.id,
      resolved_at: resolved ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', requestId).select('id,status,admin_notes,assigned_to,resolved_at,updated_at').single();
    if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
    return apiSuccess({ request: data });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    if (error instanceof Error && error.message === 'FORBIDDEN') return apiError(ErrorCode.UNAUTHORIZED, 'Forbidden', 403);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to update cancellation request', 500);
  }
}
