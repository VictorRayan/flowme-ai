import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

const EVENT_FIELDS = 'id, title, description, start_at, end_at, scheduled_date, duration_minutes, source_type, outcome, is_time_blocked';
const VALID_PRIORITY_LABELS = ['non_negotiable', 'negotiable', 'routine'];
const VALID_OUTCOMES = ['pending', 'completed', 'skipped', 'moved', 'incomplete', 'blocked', 'deferred'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { id } = await params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};

    for (const field of ['title', 'description', 'start_at', 'end_at', 'scheduled_date', 'duration_minutes', 'outcome', 'is_time_blocked'] as const) {
      if (field in body) updates[field] = body[field];
    }
    if ('priority_label' in body) updates.category = body.priority_label;

    if (Object.keys(updates).length === 0) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'No fields to update');
    }
    if (typeof updates.title === 'string') updates.title = updates.title.trim();
    if (updates.title === '') return apiError(ErrorCode.VALIDATION_ERROR, 'Title cannot be empty');
    if (updates.scheduled_date && (typeof updates.scheduled_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(updates.scheduled_date))) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'scheduled_date must be YYYY-MM-DD');
    }
    if (updates.category && !VALID_PRIORITY_LABELS.includes(String(updates.category))) {
      return apiError(ErrorCode.VALIDATION_ERROR, `priority_label must be one of: ${VALID_PRIORITY_LABELS.join(', ')}`);
    }
    if (updates.outcome && !VALID_OUTCOMES.includes(String(updates.outcome))) {
      return apiError(ErrorCode.VALIDATION_ERROR, `outcome must be one of: ${VALID_OUTCOMES.join(', ')}`);
    }
    if (updates.end_at && updates.start_at && new Date(String(updates.end_at)) <= new Date(String(updates.start_at))) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'end_at must be strictly greater than start_at');
    }

    const { data: event, error } = await supabase
      .from('microactivities')
      .update(updates)
      .eq('user_id', user.id)
      .eq('id', id)
      .select(EVENT_FIELDS)
      .single();

    if (error) throw error;
    if (!event) return apiError(ErrorCode.NOT_FOUND, 'Event not found', 404);

    return apiSuccess({ event });
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('PATCH /api/events/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to update event', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { id } = await params;

    const { error } = await supabase
      .from('microactivities')
      .delete()
      .eq('user_id', user.id)
      .eq('id', id);

    if (error) throw error;

    return apiSuccess({ deleted: true });
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('DELETE /api/events/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to delete event', 500);
  }
}
