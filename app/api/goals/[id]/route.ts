import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

const GOAL_FIELDS = `
  id, title, description, timeframe, parent_goal_id, status, target_date,
  objective_metric, target_value, current_value, unit, starts_on, due_on, success_criteria,
  created_at, updated_at
`;

const VALID_TIMEFRAMES = ['yearly', 'monthly', 'weekly'];
const VALID_STATUSES = ['not_started', 'in_progress', 'completed', 'cancelled'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { id } = await params;
    const body = await req.json();
    const allowed = [
      'title',
      'description',
      'timeframe',
      'parent_goal_id',
      'status',
      'target_date',
      'objective_metric',
      'target_value',
      'current_value',
      'unit',
      'starts_on',
      'due_on',
      'success_criteria',
    ];

    const updates: Record<string, string | number | null> = {};
    for (const field of allowed) {
      if (field in body) {
        const value = body[field];
        updates[field] = typeof value === 'string' ? value.trim() || null : value ?? null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'No fields to update');
    }
    if (updates.title === null) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'title cannot be empty');
    }
    if (updates.timeframe && !VALID_TIMEFRAMES.includes(String(updates.timeframe))) {
      return apiError(ErrorCode.VALIDATION_ERROR, `timeframe must be one of: ${VALID_TIMEFRAMES.join(', ')}`);
    }
    if (updates.status && !VALID_STATUSES.includes(String(updates.status))) {
      return apiError(ErrorCode.VALIDATION_ERROR, `status must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const { data, error } = await supabase
      .from('smart_goals')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select(GOAL_FIELDS)
      .single();

    if (error) throw error;
    if (!data) return apiError(ErrorCode.NOT_FOUND, 'Goal not found', 404);

    return apiSuccess({ goal: data });
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    console.error('PATCH /api/goals/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to update goal', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { id } = await params;

    const { error } = await supabase
      .from('smart_goals')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    return apiSuccess({ deleted: true });
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    console.error('DELETE /api/goals/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to delete goal', 500);
  }
}
