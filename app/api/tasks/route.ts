import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

const TASK_FIELDS = `
  id, title, description, notes, category, status, priority,
  scheduled_date, start_at, end_at, completed_at,
  linked_goal_id, action_plan_id, plan_day,
  is_recurring, recurrence_rule, created_at, updated_at
`;

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth();
    const { searchParams } = new URL(req.url);

    const date = searchParams.get('date');           // YYYY-MM-DD — filter by scheduled_date
    const category = searchParams.get('category');   // non_negotiable | negotiable | routine
    const status = searchParams.get('status');       // pending | completed | skipped
    const goalId = searchParams.get('goal_id');
    const planId = searchParams.get('plan_id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);

    let query = supabase
      .from('microactivities')
      .select(TASK_FIELDS)
      .eq('user_id', user.id)
      .order('priority', { ascending: false })
      .order('scheduled_date', { ascending: true })
      .order('start_at', { ascending: true })
      .limit(limit);

    if (date) query = query.eq('scheduled_date', date);
    if (category) query = query.eq('category', category);
    if (status) query = query.eq('status', status);
    if (goalId) query = query.eq('linked_goal_id', goalId);
    if (planId) query = query.eq('action_plan_id', planId);

    const { data, error } = await query;
    if (error) throw error;

    return apiSuccess({ tasks: data || [] });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('GET /api/tasks error:', err);
    return apiError(ErrorCode.SUPABASE_ERROR, 'Failed to fetch tasks', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth();
    const body = await req.json();

    const {
      title, description, notes, category, priority,
      scheduled_date, start_at, end_at,
      linked_goal_id, action_plan_id, plan_day,
      is_recurring, recurrence_rule,
    } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'Title is required');
    }

    const validCategories = ['non_negotiable', 'negotiable', 'routine'];
    const resolvedCategory = validCategories.includes(category) ? category : 'negotiable';

    const { data, error } = await supabase
      .from('microactivities')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        notes: notes?.trim() || null,
        category: resolvedCategory,
        status: 'pending',
        priority: typeof priority === 'number' ? Math.min(3, Math.max(0, priority)) : 0,
        scheduled_date: scheduled_date || new Date().toISOString().split('T')[0],
        start_at: start_at || new Date().toISOString(),
        end_at: end_at || null,
        linked_goal_id: linked_goal_id || null,
        action_plan_id: action_plan_id || null,
        plan_day: plan_day || null,
        is_recurring: Boolean(is_recurring),
        recurrence_rule: recurrence_rule || null,
      })
      .select(TASK_FIELDS)
      .single();

    if (error) throw error;

    return apiSuccess({ task: data });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('POST /api/tasks error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to create task', 500);
  }
}
