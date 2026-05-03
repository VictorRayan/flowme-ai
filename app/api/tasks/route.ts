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
    const { supabase, user } = await requireAuth(req);
    const body = await req.json();

    const {
      title, description, notes, category, priority,
      scheduled_date, start_at, end_at, duration_minutes,
      linked_goal_id, action_plan_id, plan_day,
      is_recurring, recurrence_rule, source_type, source_id, outcome, outcome_reason,
      moved_to_task_id, priority_source, priority_reason, is_time_blocked, sort_order,
    } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'Title is required');
    }

    if (category && !VALID_CATEGORIES.includes(category)) {
      return apiError(ErrorCode.VALIDATION_ERROR, `category must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }
    if (outcome && !VALID_OUTCOMES.includes(outcome)) {
      return apiError(ErrorCode.VALIDATION_ERROR, `outcome must be one of: ${VALID_OUTCOMES.join(', ')}`);
    }
    if (source_type && !VALID_SOURCE_TYPES.includes(source_type)) {
      return apiError(ErrorCode.VALIDATION_ERROR, `source_type must be one of: ${VALID_SOURCE_TYPES.join(', ')}`);
    }
    if (priority_source && !VALID_PRIORITY_SOURCES.includes(priority_source)) {
      return apiError(ErrorCode.VALIDATION_ERROR, `priority_source must be one of: ${VALID_PRIORITY_SOURCES.join(', ')}`);
    }
    if (typeof duration_minutes === 'number' && duration_minutes < 0) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'duration_minutes must be greater than or equal to 0');
    }

    const resolvedDuration = typeof duration_minutes === 'number'
      ? duration_minutes
      : inferDurationMinutes(start_at, end_at);
    const resolvedCategory = category || 'negotiable';
    const resolvedOutcome = outcome || 'pending';

    const { data, error } = await supabase
      .from('microactivities')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        notes: notes?.trim() || null,
        category: resolvedCategory,
        status: mapOutcomeToStatus(resolvedOutcome),
        priority: typeof priority === 'number' ? Math.min(3, Math.max(0, priority)) : 0,
        scheduled_date: scheduled_date || new Date().toISOString().split('T')[0],
        start_at: start_at || new Date().toISOString(),
        end_at: end_at || null,
        duration_minutes: resolvedDuration,
        linked_goal_id: linked_goal_id || null,
        action_plan_id: action_plan_id || null,
        plan_day: plan_day || null,
        is_recurring: Boolean(is_recurring),
        recurrence_rule: recurrence_rule || null,
        source_type: source_type || 'manual',
        source_id: source_id || null,
        outcome: resolvedOutcome,
        outcome_reason: outcome_reason || null,
        moved_to_task_id: moved_to_task_id || null,
        priority_source: priority_source || 'system',
        priority_reason: priority_reason || null,
        is_time_blocked: typeof is_time_blocked === 'boolean'
          ? is_time_blocked
          : Boolean(start_at && end_at),
        sort_order: typeof sort_order === 'number' ? sort_order : 0,
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

function inferDurationMinutes(startAt?: string | null, endAt?: string | null): number | null {
  if (!startAt || !endAt) return null;
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.max(1, Math.ceil((end - start) / 60000));
}

function mapOutcomeToStatus(outcome: string): 'pending' | 'completed' | 'skipped' {
  if (outcome === 'completed') return 'completed';
  if (outcome === 'skipped') return 'skipped';
  return 'pending';
}
