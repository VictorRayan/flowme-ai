import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

const TASK_FIELDS = `
  id, title, description, notes, category, status, priority,
  scheduled_date, start_at, end_at, completed_at,
  linked_goal_id, action_plan_id, plan_day,
  is_recurring, recurrence_rule, created_at, updated_at
`;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const allowedFields = [
      'title', 'description', 'notes', 'category', 'status', 'priority',
      'scheduled_date', 'start_at', 'end_at',
      'linked_goal_id', 'action_plan_id', 'plan_day',
      'is_recurring', 'recurrence_rule',
    ];

    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'No fields to update');
    }

    // Auto-set completed_at when marking complete
    if (updates.status === 'completed') {
      updates.completed_at = new Date().toISOString();
    } else if (updates.status === 'pending' || updates.status === 'skipped') {
      updates.completed_at = null;
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
    console.error('PATCH /api/tasks/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to update task', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth();
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
