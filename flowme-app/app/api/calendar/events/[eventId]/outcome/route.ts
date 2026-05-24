import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { clearEventOutcome, EVENT_OUTCOMES, upsertEventOutcome, type EventOutcome } from '@/lib/today/event-outcomes';

export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { eventId } = await params;
    if (!eventId?.trim()) return apiError(ErrorCode.VALIDATION_ERROR, 'eventId is required');

    const body = await req.json().catch(() => ({}));
    const outcome = body.outcome as EventOutcome | undefined;
    if (!outcome || !EVENT_OUTCOMES.includes(outcome)) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'outcome must be one of: ' + EVENT_OUTCOMES.join(', '));
    }
    const row = await upsertEventOutcome(supabase as any, user.id, {
      event_id: eventId,
      outcome,
      outcome_reason: typeof body.outcome_reason === 'string' ? body.outcome_reason : null,
      linked_account_id: typeof body.linked_account_id === 'string' ? body.linked_account_id : null,
    });
    return apiSuccess({ outcome: row });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('POST /api/calendar/events/[eventId]/outcome error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, err?.message || 'Failed to update outcome', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { eventId } = await params;
    if (!eventId?.trim()) return apiError(ErrorCode.VALIDATION_ERROR, 'eventId is required');
    await clearEventOutcome(supabase as any, user.id, eventId);
    return apiSuccess({ deleted: true });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('DELETE /api/calendar/events/[eventId]/outcome error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, err?.message || 'Failed to clear outcome', 500);
  }
}
