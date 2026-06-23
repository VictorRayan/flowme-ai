import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { requireManagementRole } from '@/lib/billing/admin-auth';

const WORKFLOW_STATUSES = ['in_review', 'needs_info'] as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireManagementRole(req, ['support_manager', 'billing_manager', 'admin']);
    const { id } = await params;
    const admin = getSupabaseAdmin();
    const [requestResult, eventsResult] = await Promise.all([
      admin.from('subscription_cancellation_requests').select('*').eq('id', id).single(),
      admin.from('subscription_cancellation_request_events').select('*').eq('request_id', id).order('created_at'),
    ]);
    if (requestResult.error) return apiError(ErrorCode.NOT_FOUND, 'CANCELLATION_REQUEST_NOT_FOUND', 404);
    return apiSuccess({ request: requestResult.data, events: eventsResult.data || [] });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'FORBIDDEN') return apiError(ErrorCode.UNAUTHORIZED, 'Forbidden', 403);
    return apiError(ErrorCode.INTERNAL_ERROR, 'CANCELLATION_MANAGEMENT_LOAD_FAILED', 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireManagementRole(req, ['support_manager', 'billing_manager', 'admin']);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const status = WORKFLOW_STATUSES.includes(body.status) ? body.status : null;
    const adminNotes = typeof body.admin_notes === 'string' ? body.admin_notes.trim() : '';
    if (!status || adminNotes.length > 4000) return apiError(ErrorCode.VALIDATION_ERROR, 'CANCELLATION_WORKFLOW_INVALID', 400);
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.from('subscription_cancellation_requests').update({
      status, assigned_to: user.id, admin_notes: adminNotes || null, updated_at: new Date().toISOString(),
    }).eq('id', id).select('*').single();
    if (error) return apiError(ErrorCode.SUPABASE_ERROR, 'CANCELLATION_UPDATE_FAILED', 500);
    await admin.from('subscription_cancellation_request_events').insert({
      request_id: id, actor_user_id: user.id, event_type: status, to_status: status, metadata: {},
    });
    return apiSuccess({ request: data });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'FORBIDDEN') return apiError(ErrorCode.UNAUTHORIZED, 'Forbidden', 403);
    return apiError(ErrorCode.INTERNAL_ERROR, 'CANCELLATION_UPDATE_FAILED', 500);
  }
}
