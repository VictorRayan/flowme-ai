import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { requireManagementRole } from '@/lib/billing/admin-auth';

const DECISIONS = ['retained', 'rejected', 'approved_cancel'] as const;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireManagementRole(req, ['support_manager', 'billing_manager', 'admin']);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const decision = DECISIONS.includes(body.decision) ? body.decision : null;
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!decision || reason.length < 10 || reason.length > 4000) return apiError(ErrorCode.VALIDATION_ERROR, 'CANCELLATION_DECISION_INVALID', 400);
    const now = new Date().toISOString();
    const terminal = decision !== 'approved_cancel';
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('subscription_cancellation_requests').update({
      decision, decision_reason: reason, decided_by: user.id, decided_at: now, status: decision,
      assigned_to: user.id, resolved_at: terminal ? now : null, updated_at: now,
    }).eq('id', id).in('status', ['open', 'in_review', 'needs_info']).select('*').single();
    if (error) return apiError(ErrorCode.SUPABASE_ERROR, 'CANCELLATION_DECISION_FAILED', 500);
    await admin.from('subscription_cancellation_request_events').insert({
      request_id: id, actor_user_id: user.id, event_type: 'decision', to_status: decision, metadata: { decision },
    });
    return apiSuccess({ request: data });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'FORBIDDEN') return apiError(ErrorCode.UNAUTHORIZED, 'Forbidden', 403);
    return apiError(ErrorCode.INTERNAL_ERROR, 'CANCELLATION_DECISION_FAILED', 500);
  }
}
