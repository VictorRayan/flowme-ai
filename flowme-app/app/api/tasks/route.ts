import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

const TASK_FIELDS = `
  id, title, description, category, status, priority,
  linked_goal_id, action_plan_id, plan_day, scheduled_date, start_at, end_at,
  duration_minutes, source_type, source_id, outcome,
  priority_source, priority_reason, is_time_blocked, sort_order, created_at, updated_at
`;

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const date = searchParams.get('date');           // YYYY-MM-DD — filter by scheduled_date
    const category = searchParams.get('category');   // non_negotiable | negotiable | routine
    const status = searchParams.get('status');       // pending | completed | skipped
    const goalId = searchParams.get('goal_id');
    const planId = searchParams.get('plan_id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);

    let query = supabase
      .from('action_plan_tasks')
      .select(TASK_FIELDS)
      .eq('user_id', user.id)
      .order('scheduled_date', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('start_at', { ascending: true })
      .limit(limit);

    if (date) query = query.eq('scheduled_date', date);
    if (category) query = query.eq('category', category);
    if (status) query = query.eq('status', status);
    if (goalId) query = query.eq('linked_goal_id', goalId);
    if (planId) query = query.eq('action_plan_id', planId);

    const { data, error } = await query;
    if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);

    return apiSuccess({ tasks: data || [] });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('GET /api/tasks error:', err);
    return apiError(ErrorCode.SUPABASE_ERROR, 'Failed to fetch tasks', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    return apiError(
      ErrorCode.VALIDATION_ERROR,
      'Local tasks are no longer supported. Create a Google Calendar event instead.',
      410,
    );
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('POST /api/tasks error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to create task', 500);
  }
}
