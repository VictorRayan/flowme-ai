import type { SupabaseClient } from '@supabase/supabase-js';
import { buildGoalOperatingPlan, GoalProposalInput } from '@/lib/goals/planner';

const GOAL_FIELDS = 'id, title, timeframe, parent_goal_id, status, starts_on, due_on, target_date, success_criteria';
const ACTION_PLAN_FIELDS = 'id, title, plan_type, linked_goal_id, linked_goal_ids, status, starts_on, review_date, success_criteria';
const TASK_FIELDS = 'id, title, category, status, outcome, scheduled_date, start_at, end_at, duration_minutes, linked_goal_id, action_plan_id, plan_day, sort_order';
export async function persistGoalOperatingPlan(
  supabase: SupabaseClient,
  userId: string,
  input: GoalProposalInput,
) {
  const plan = buildGoalOperatingPlan(input);
  const created: {
    goalIds: string[];
    actionPlanId: string | null;
    taskIds: string[];
  } = {
    goalIds: [],
    actionPlanId: null,
    taskIds: [],
  };

  try {
    const yearly = await insertGoal(supabase, userId, plan.goals[0], null);
    created.goalIds.push(yearly.id);
    const monthly = await insertGoal(supabase, userId, plan.goals[1], yearly.id);
    created.goalIds.push(monthly.id);
    const weekly = await insertGoal(supabase, userId, plan.goals[2], monthly.id);
    created.goalIds.push(weekly.id);

    const { data: actionPlan, error: actionPlanError } = await supabase
      .from('action_plans')
      .insert({
        user_id: userId,
        title: plan.action_plan.title,
        description: plan.action_plan.description,
        linked_goal_id: yearly.id,
        linked_goal_ids: [yearly.id, monthly.id, weekly.id],
        plan_type: plan.action_plan.plan_type,
        status: 'in_progress',
        duration_days: plan.action_plan.duration_days,
        starts_on: plan.action_plan.starts_on,
        review_date: plan.action_plan.review_date,
        success_criteria: plan.action_plan.success_criteria,
        priority_label: plan.action_plan.priority_label,
      })
      .select(ACTION_PLAN_FIELDS)
      .single();

    if (actionPlanError) throw actionPlanError;
    created.actionPlanId = actionPlan.id;

    const { error: linksError } = await supabase.from('action_plan_goal_links').insert([
      { user_id: userId, action_plan_id: actionPlan.id, goal_id: yearly.id },
      { user_id: userId, action_plan_id: actionPlan.id, goal_id: monthly.id },
      { user_id: userId, action_plan_id: actionPlan.id, goal_id: weekly.id },
    ]);

    if (linksError) throw linksError;

    const { data: tasks, error: tasksError } = await supabase
      .from('action_plan_tasks')
      .insert(plan.active_tasks.map(task => {
        const startAt = task.start_at || `${task.scheduled_date}T09:00:00.000Z`;
        const endAt = task.end_at || addMinutesIso(startAt, task.duration_minutes);
        return {
          user_id: userId,
          title: task.title,
          description: task.description,
          start_at: startAt,
          end_at: endAt,
          category: task.category,
          status: 'pending',
          priority: task.priority,
          scheduled_date: task.scheduled_date,
          linked_goal_id: weekly.id,
          action_plan_id: actionPlan.id,
          plan_day: task.plan_day,
          duration_minutes: task.duration_minutes,
          source_type: task.source_type,
          source_id: task.client_id,
          outcome: 'pending',
          priority_source: task.priority_source,
          priority_reason: task.priority_reason,
          is_time_blocked: Boolean(task.start_at && task.end_at),
          sort_order: task.sort_order,
        };
      }))
      .select(TASK_FIELDS);

    if (tasksError) throw tasksError;
    created.taskIds = (tasks || []).map((task: { id: string }) => task.id);

    return {
      plan,
      persisted: {
        goals: { yearly, monthly, weekly },
        action_plan: actionPlan,
        tasks: tasks || [],
      },
    };
  } catch (error) {
    await cleanupCreatedPlan(supabase, userId, created);
    throw error;
  }
}

async function insertGoal(
  supabase: SupabaseClient,
  userId: string,
  goal: {
    title: string;
    description: string;
    timeframe: 'yearly' | 'monthly' | 'weekly';
    status: 'not_started' | 'in_progress';
    starts_on: string;
    due_on: string;
    target_date: string;
    success_criteria: string;
  },
  parentGoalId: string | null,
) {
  const { data, error } = await supabase
    .from('smart_goals')
    .insert({
      user_id: userId,
      title: goal.title,
      description: goal.description,
      timeframe: goal.timeframe,
      parent_goal_id: parentGoalId,
      status: goal.status,
      starts_on: goal.starts_on,
      due_on: goal.due_on,
      target_date: goal.target_date,
      success_criteria: goal.success_criteria,
    })
    .select(GOAL_FIELDS)
    .single();

  if (error) throw error;
  return data;
}

export async function cleanupPersistedGoalOperatingPlan(
  supabase: SupabaseClient,
  userId: string,
  persisted: {
    goals?: { yearly?: { id: string }; monthly?: { id: string }; weekly?: { id: string } };
    action_plan?: { id: string };
  },
) {
  await cleanupCreatedPlan(supabase, userId, {
    actionPlanId: persisted.action_plan?.id || null,
    taskIds: [],
    goalIds: [
      persisted.goals?.yearly?.id,
      persisted.goals?.monthly?.id,
      persisted.goals?.weekly?.id,
    ].filter((id): id is string => Boolean(id)),
  });
}

async function cleanupCreatedPlan(
  supabase: SupabaseClient,
  userId: string,
  created: { goalIds: string[]; actionPlanId: string | null; taskIds: string[] },
) {
  const cleanupErrors: unknown[] = [];
  const run = async (label: string, operation: unknown) => {
    try {
      await (operation as PromiseLike<unknown>);
    } catch (error) {
      cleanupErrors.push({ label, error });
    }
  };

  if (created.actionPlanId) {
    await run('action_plan_tasks_by_action_plan', supabase
      .from('action_plan_tasks')
      .delete()
      .eq('user_id', userId)
      .eq('action_plan_id', created.actionPlanId));

    await run('action_plan_goal_links', supabase
      .from('action_plan_goal_links')
      .delete()
      .eq('user_id', userId)
      .eq('action_plan_id', created.actionPlanId));

    await run('action_plan', supabase
      .from('action_plans')
      .delete()
      .eq('user_id', userId)
      .eq('id', created.actionPlanId));
  }

  if (created.goalIds.length > 0) {
    await run('goals', supabase
      .from('smart_goals')
      .delete()
      .eq('user_id', userId)
      .in('id', created.goalIds));
  }

  if (cleanupErrors.length > 0) {
    console.error('Goal operating plan cleanup had partial failures:', cleanupErrors);
  }
}

function addMinutesIso(startIso: string, minutes: number): string {
  return new Date(new Date(startIso).getTime() + minutes * 60000).toISOString();
}
