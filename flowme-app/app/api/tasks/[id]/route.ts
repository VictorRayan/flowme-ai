import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

const TASK_FIELDS = `
  id, title, description, notes, category, status, priority,
  scheduled_date, start_at, end_at, completed_at, duration_minutes,
  linked_goal_id, action_plan_id, plan_day,
  is_recurring, recurrence_rule, source_type, source_id, outcome, outcome_reason,
  moved_to_task_id, priority_source, priority_reason, is_time_blocked, sort_order,
  created_at, updated_at
`;

const VALID_CATEGORIES = ['non_negotiable', 'negotiable', 'routine'];
const VALID_STATUSES = ['pending', 'completed', 'skipped'];
const VALID_OUTCOMES = ['pending', 'completed', 'skipped', 'moved', 'incomplete', 'blocked', 'deferred'];
const VALID_SOURCE_TYPES = ['calendar_event', 'goal_task', 'action_plan_task', 'manual'];
const VALID_PRIORITY_SOURCES = ['user', 'balys', 'system'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { id } = await params;
    const body = await req.json();

    const allowedFields = [
      'title', 'description', 'notes', 'category', 'status', 'priority',
      'scheduled_date', 'start_at', 'end_at', 'duration_minutes',
      'linked_goal_id', 'action_plan_id', 'plan_day',
      'is_recurring', 'recurrence_rule', 'source_type', 'source_id', 'outcome', 'outcome_reason',
      'moved_to_task_id', 'priority_source', 'priority_reason', 'is_time_blocked', 'sort_order',
    ];

    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'No fields to update');
    }
    if (updates.category && !VALID_CATEGORIES.includes(String(updates.category))) {
      return apiError(ErrorCode.VALIDATION_ERROR, `category must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }
    if (updates.status && !VALID_STATUSES.includes(String(updates.status))) {
      return apiError(ErrorCode.VALIDATION_ERROR, `status must be one of: ${VALID_STATUSES.join(', ')}`);
    }
    if (updates.outcome && !VALID_OUTCOMES.includes(String(updates.outcome))) {
      return apiError(ErrorCode.VALIDATION_ERROR, `outcome must be one of: ${VALID_OUTCOMES.join(', ')}`);
    }
    if (updates.source_type && !VALID_SOURCE_TYPES.includes(String(updates.source_type))) {
      return apiError(ErrorCode.VALIDATION_ERROR, `source_type must be one of: ${VALID_SOURCE_TYPES.join(', ')}`);
    }
    if (updates.priority_source && !VALID_PRIORITY_SOURCES.includes(String(updates.priority_source))) {
      return apiError(ErrorCode.VALIDATION_ERROR, `priority_source must be one of: ${VALID_PRIORITY_SOURCES.join(', ')}`);
    }
    if (typeof updates.duration_minutes === 'number' && updates.duration_minutes < 0) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'duration_minutes must be greater than or equal to 0');
    }

    // Auto-set completed_at when marking complete
    if (updates.status === 'completed' || updates.outcome === 'completed') {
      updates.completed_at = new Date().toISOString();
      updates.status = 'completed';
      updates.outcome = 'completed';
    } else if (updates.status === 'skipped' || updates.outcome === 'skipped') {
      updates.completed_at = null;
      updates.status = 'skipped';
      updates.outcome = 'skipped';
    } else if (updates.status === 'pending' || updates.outcome === 'pending') {
      updates.completed_at = null;
      updates.status = 'pending';
      updates.outcome = 'pending';
    }

    const { data, error } = await supabase
      .from('microactivities')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select(TASK_FIELDS)
      .single();

    if (error) throw error;
    if (!data) return apiError(ErrorCode.NOT_FOUND, 'Task not found', 404);

    return apiSuccess({ task: data });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    const detail = err?.message || err?.details || err?.hint || JSON.stringify(err);
    console.error('PATCH /api/tasks/[id] error:', detail, err);
    return apiError(ErrorCode.INTERNAL_ERROR, detail || 'Failed to update task', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { id } = await params;

    const { error } = await supabase
      .from('microactivities')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    return apiSuccess({ deleted: true });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('DELETE /api/tasks/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to delete task', 500);
  }
}
