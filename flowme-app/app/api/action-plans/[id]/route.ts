import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

const ACTION_PLAN_FIELDS = `
  id, title, description, linked_goal_id, linked_goal_ids, plan_type, problem_statement,
  status, duration_days, starts_on, review_date, success_criteria,
  created_at, updated_at
`;

const VALID_PLAN_TYPES = ['goal_plan', 'short_term_problem'];
const VALID_STATUSES = ['not_started', 'in_progress', 'completed', 'cancelled'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { id } = await params;
    const body = await req.json();
    const linkedGoalIds = 'linked_goal_ids' in body || 'linked_goal_id' in body
      ? normalizeGoalIds(body.linked_goal_ids, body.linked_goal_id)
      : null;

    const updates: Record<string, string | number | string[] | null> = {};
    const stringFields = [
      'title',
      'description',
      'plan_type',
      'problem_statement',
      'status',
      'starts_on',
      'review_date',
      'success_criteria',
    ];

    for (const field of stringFields) {
      if (field in body) {
        const value = body[field];
        updates[field] = typeof value === 'string' ? value.trim() || null : value ?? null;
      }
    }
    if ('duration_days' in body) updates.duration_days = body.duration_days;
    if (linkedGoalIds) {
      updates.linked_goal_ids = linkedGoalIds;
      updates.linked_goal_id = linkedGoalIds[0] || null;
    }

    if (Object.keys(updates).length === 0) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'No fields to update');
    }
    if (updates.title === null) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'title cannot be empty');
    }
    if (updates.plan_type && !VALID_PLAN_TYPES.includes(String(updates.plan_type))) {
      return apiError(ErrorCode.VALIDATION_ERROR, `plan_type must be one of: ${VALID_PLAN_TYPES.join(', ')}`);
    }
    if (updates.status && !VALID_STATUSES.includes(String(updates.status))) {
      return apiError(ErrorCode.VALIDATION_ERROR, `status must be one of: ${VALID_STATUSES.join(', ')}`);
    }
    const { data, error } = await supabase
      .from('action_plans')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select(ACTION_PLAN_FIELDS)
      .single();

    if (error) throw error;
    if (!data) return apiError(ErrorCode.NOT_FOUND, 'Action plan not found', 404);

    if (linkedGoalIds) {
      await supabase
        .from('action_plan_goal_links')
        .delete()
        .eq('user_id', user.id)
        .eq('action_plan_id', id);

      if (linkedGoalIds.length > 0) {
        await supabase.from('action_plan_goal_links').insert(
          linkedGoalIds.map(goalId => ({
            user_id: user.id,
            action_plan_id: id,
            goal_id: goalId,
          }))
        );
      }
    }

    return apiSuccess({ action_plan: data });
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    console.error('PATCH /api/action-plans/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to update action plan', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { id } = await params;

    const { error } = await supabase
      .from('action_plans')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    return apiSuccess({ deleted: true });
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    console.error('DELETE /api/action-plans/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to delete action plan', 500);
  }
}

function normalizeGoalIds(value: unknown, legacyValue: unknown): string[] {
  const ids = Array.isArray(value) ? value : [];
  if (typeof legacyValue === 'string' && legacyValue.trim()) ids.unshift(legacyValue);
  return Array.from(new Set(ids.filter((goalId): goalId is string => typeof goalId === 'string' && goalId.trim().length > 0)));
}
