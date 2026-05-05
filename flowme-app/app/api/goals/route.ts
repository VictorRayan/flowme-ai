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

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const timeframe = searchParams.get('timeframe');
    const status = searchParams.get('status');
    const parentGoalId = searchParams.get('parent_goal_id');

    let query = supabase
      .from('smart_goals')
      .select(GOAL_FIELDS)
      .eq('user_id', user.id)
      .order('target_date', { ascending: true })
      .order('created_at', { ascending: false });

    if (timeframe) {
      if (!VALID_TIMEFRAMES.includes(timeframe)) {
        return apiError(ErrorCode.VALIDATION_ERROR, `timeframe must be one of: ${VALID_TIMEFRAMES.join(', ')}`);
      }
      query = query.eq('timeframe', timeframe);
    }

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return apiError(ErrorCode.VALIDATION_ERROR, `status must be one of: ${VALID_STATUSES.join(', ')}`);
      }
      query = query.eq('status', status);
    }

    if (parentGoalId) query = query.eq('parent_goal_id', parentGoalId);

    const { data, error } = await query;
    if (error) throw error;

    return apiSuccess({ goals: data || [] });
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    console.error('GET /api/goals error:', err);
    return apiError(ErrorCode.SUPABASE_ERROR, 'Failed to fetch goals', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const body = await req.json();
    const {
      title,
      description,
      timeframe,
      parent_goal_id,
      status,
      target_date,
      objective_metric,
      target_value,
      current_value,
      unit,
      starts_on,
      due_on,
      success_criteria,
    } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'title is required');
    }
    if (!VALID_TIMEFRAMES.includes(timeframe)) {
      return apiError(ErrorCode.VALIDATION_ERROR, `timeframe must be one of: ${VALID_TIMEFRAMES.join(', ')}`);
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return apiError(ErrorCode.VALIDATION_ERROR, `status must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const { data, error } = await supabase
      .from('smart_goals')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: typeof description === 'string' ? description.trim() || null : null,
        timeframe,
        parent_goal_id: parent_goal_id || null,
        status: status || 'not_started',
        target_date: target_date || null,
        objective_metric: typeof objective_metric === 'string' ? objective_metric.trim() || null : null,
        target_value: typeof target_value === 'number' ? target_value : null,
        current_value: typeof current_value === 'number' ? current_value : 0,
        unit: typeof unit === 'string' ? unit.trim() || null : null,
        starts_on: starts_on || null,
        due_on: due_on || null,
        success_criteria: typeof success_criteria === 'string' ? success_criteria.trim() || null : null,
      })
      .select(GOAL_FIELDS)
      .single();

    if (error) throw error;

    return apiSuccess({ goal: data });
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    console.error('POST /api/goals error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to create goal', 500);
  }
}
