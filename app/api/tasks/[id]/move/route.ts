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

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  category: string | null;
  priority: number | null;
  scheduled_date: string | null;
  start_at: string | null;
  end_at: string | null;
  duration_minutes: number | null;
  linked_goal_id: string | null;
  action_plan_id: string | null;
  plan_day: number | null;
  is_recurring: boolean | null;
  recurrence_rule: string | null;
  source_type: string | null;
  priority_source: string | null;
  priority_reason: string | null;
  is_time_blocked: boolean | null;
  sort_order: number | null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { id } = await params;
    const body = await req.json();
    const scheduledDate = body.scheduled_date;

    if (!scheduledDate || typeof scheduledDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'scheduled_date must be YYYY-MM-DD');
    }

    const { data: task, error: fetchError } = await supabase
      .from('microactivities')
      .select(TASK_FIELDS)
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError) throw fetchError;
    if (!task) return apiError(ErrorCode.NOT_FOUND, 'Task not found', 404);

    const source = task as TaskRow;
    const { data: newTask, error: insertError } = await supabase
      .from('microactivities')
      .insert({
        user_id: user.id,
        title: source.title,
        description: source.description,
        notes: source.notes,
        category: source.category || 'negotiable',
        status: 'pending',
        priority: source.priority || 0,
        scheduled_date: scheduledDate,
        start_at: shiftDatePart(source.start_at, scheduledDate),
        end_at: shiftDatePart(source.end_at, scheduledDate),
        completed_at: null,
        duration_minutes: source.duration_minutes,
        linked_goal_id: source.linked_goal_id,
        action_plan_id: source.action_plan_id,
        plan_day: source.plan_day,
        is_recurring: source.is_recurring || false,
        recurrence_rule: source.recurrence_rule,
        source_type: source.source_type || 'manual',
        source_id: null,
        outcome: 'pending',
        outcome_reason: null,
        moved_to_task_id: null,
        priority_source: source.priority_source || 'system',
        priority_reason: source.priority_reason,
        is_time_blocked: source.is_time_blocked || false,
        sort_order: source.sort_order || 0,
      })
      .select(TASK_FIELDS)
      .single();

    if (insertError) throw insertError;

    const { data: originalTask, error: updateError } = await supabase
      .from('microactivities')
      .update({
        outcome: 'moved',
        outcome_reason: typeof body.outcome_reason === 'string' ? body.outcome_reason.trim() || 'Moved' : 'Moved',
        moved_to_task_id: newTask.id,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select(TASK_FIELDS)
      .single();

    if (updateError) throw updateError;

    return apiSuccess({ moved: true, original_task: originalTask, new_task: newTask });
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    console.error('POST /api/tasks/[id]/move error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to move task', 500);
  }
}

function shiftDatePart(iso: string | null, scheduledDate: string): string | null {
  if (!iso) return null;
  const timePart = iso.includes('T') ? iso.slice(10) : 'T00:00:00.000Z';
  return `${scheduledDate}${timePart}`;
}
