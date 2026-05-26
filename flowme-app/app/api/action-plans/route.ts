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

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const planType = searchParams.get('plan_type');
    const status = searchParams.get('status');
    const goalId = searchParams.get('goal_id');

    let query = supabase
      .from('action_plans')
      .select(ACTION_PLAN_FIELDS)
      .eq('user_id', user.id)
      .order('review_date', { ascending: true })
      .order('created_at', { ascending: false });

    if (planType) {
      if (!VALID_PLAN_TYPES.includes(planType)) {
        return apiError(ErrorCode.VALIDATION_ERROR, `plan_type must be one of: ${VALID_PLAN_TYPES.join(', ')}`);
      }
      query = query.eq('plan_type', planType);
    }

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return apiError(ErrorCode.VALIDATION_ERROR, `status must be one of: ${VALID_STATUSES.join(', ')}`);
      }
      query = query.eq('status', status);
    }

    if (goalId) query = query.or(`linked_goal_id.eq.${goalId},linked_goal_ids.cs.{${goalId}}`);

    const { data, error } = await query;
    if (error) throw error;

    return apiSuccess({ action_plans: data || [] });
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    console.error('GET /api/action-plans error:', err);
    return apiError(ErrorCode.SUPABASE_ERROR, 'Failed to fetch action plans', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const body = await req.json();
    const linkedGoalIds = normalizeGoalIds(body.linked_goal_ids, body.linked_goal_id);

    if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'title is required');
    }
    if (body.plan_type && !VALID_PLAN_TYPES.includes(body.plan_type)) {
      return apiError(ErrorCode.VALIDATION_ERROR, `plan_type must be one of: ${VALID_PLAN_TYPES.join(', ')}`);
    }
    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return apiError(ErrorCode.VALIDATION_ERROR, `status must be one of: ${VALID_STATUSES.join(', ')}`);
    }
    const { data, error } = await supabase
      .from('action_plans')
      .insert({
        user_id: user.id,
        title: body.title.trim(),
        description: typeof body.description === 'string' ? body.description.trim() || null : null,
        linked_goal_id: linkedGoalIds[0] || null,
        linked_goal_ids: linkedGoalIds,
        plan_type: body.plan_type || 'goal_plan',
        problem_statement: typeof body.problem_statement === 'string' ? body.problem_statement.trim() || null : null,
        status: body.status || 'not_started',
        duration_days: typeof body.duration_days === 'number' ? body.duration_days : 21,
        starts_on: body.starts_on || null,
        review_date: body.review_date || null,
        success_criteria: typeof body.success_criteria === 'string' ? body.success_criteria.trim() || null : null,
      })
      .select(ACTION_PLAN_FIELDS)
      .single();

    if (error) throw error;

    await supabase
      .from('action_plan_goal_links')
      .delete()
      .eq('user_id', user.id)
      .eq('action_plan_id', data.id);

    if (linkedGoalIds.length > 0) {
      await supabase.from('action_plan_goal_links').insert(
        linkedGoalIds.map(goalId => ({
          user_id: user.id,
          action_plan_id: data.id,
          goal_id: goalId,
        }))
      );
    }

    return apiSuccess({ action_plan: data });
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    console.error('POST /api/action-plans error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to create action plan', 500);
  }
}

function normalizeGoalIds(value: unknown, legacyValue: unknown): string[] {
  const ids = Array.isArray(value) ? value : [];
  if (typeof legacyValue === 'string' && legacyValue.trim()) ids.unshift(legacyValue);
  return Array.from(new Set(ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)));
}
