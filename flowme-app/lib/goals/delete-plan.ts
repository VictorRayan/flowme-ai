import type { SupabaseClient } from '@supabase/supabase-js';

export type DeletableCalendarEvent = {
  linked_account_id: string;
  provider_event_id: string;
  title: string;
  status: string;
};

export type GoalDeletionTargets = {
  goal_ids: string[];
  goal_titles: string[];
  action_plan_ids: string[];
  calendar_events: DeletableCalendarEvent[];
};

export type ActionPlanDeletionTargets = {
  action_plan_id: string;
  action_plan_title: string | null;
  calendar_events: DeletableCalendarEvent[];
};

async function fetchCalendarEvents(
  supabase: SupabaseClient,
  userId: string,
  column: 'goal_id' | 'action_plan_id',
  ids: string[],
): Promise<DeletableCalendarEvent[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('goal_calendar_events')
    .select('linked_account_id, provider_event_id, title, status')
    .eq('user_id', userId)
    .in(column, ids);
  if (error) throw error;
  return (data || []) as DeletableCalendarEvent[];
}

function dedupeEvents(events: DeletableCalendarEvent[]): DeletableCalendarEvent[] {
  const seen = new Set<string>();
  const result: DeletableCalendarEvent[] = [];
  for (const event of events) {
    const key = `${event.linked_account_id}:${event.provider_event_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(event);
  }
  return result;
}

export async function gatherGoalDeletionTargets(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
): Promise<GoalDeletionTargets> {
  const { data: allGoals, error: goalsError } = await supabase
    .from('smart_goals')
    .select('id, parent_goal_id, title')
    .eq('user_id', userId);
  if (goalsError) throw goalsError;

  const goals = (allGoals || []) as Array<{ id: string; parent_goal_id: string | null; title: string }>;
  const childrenByParent = new Map<string, string[]>();
  const titleById = new Map<string, string>();
  for (const goal of goals) {
    titleById.set(goal.id, goal.title);
    if (goal.parent_goal_id) {
      const list = childrenByParent.get(goal.parent_goal_id) || [];
      list.push(goal.id);
      childrenByParent.set(goal.parent_goal_id, list);
    }
  }

  const goalIds: string[] = [];
  const queue = [goalId];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    goalIds.push(current);
    for (const child of childrenByParent.get(current) || []) queue.push(child);
  }

  const planIds = new Set<string>();
  const { data: linkedPlans, error: linkedError } = await supabase
    .from('action_plans')
    .select('id')
    .eq('user_id', userId)
    .in('linked_goal_id', goalIds);
  if (linkedError) throw linkedError;
  for (const plan of (linkedPlans || []) as Array<{ id: string }>) planIds.add(plan.id);

  const { data: planLinks, error: planLinksError } = await supabase
    .from('action_plan_goal_links')
    .select('action_plan_id')
    .eq('user_id', userId)
    .in('goal_id', goalIds);
  if (planLinksError) throw planLinksError;
  for (const link of (planLinks || []) as Array<{ action_plan_id: string }>) planIds.add(link.action_plan_id);

  const actionPlanIds = Array.from(planIds);
  const events = dedupeEvents([
    ...(await fetchCalendarEvents(supabase, userId, 'goal_id', goalIds)),
    ...(await fetchCalendarEvents(supabase, userId, 'action_plan_id', actionPlanIds)),
  ]);

  return {
    goal_ids: goalIds,
    goal_titles: goalIds.map(id => titleById.get(id)).filter((t): t is string => Boolean(t)),
    action_plan_ids: actionPlanIds,
    calendar_events: events,
  };
}

export async function gatherActionPlanDeletionTargets(
  supabase: SupabaseClient,
  userId: string,
  actionPlanId: string,
): Promise<ActionPlanDeletionTargets> {
  const { data: plan, error: planError } = await supabase
    .from('action_plans')
    .select('id, title')
    .eq('user_id', userId)
    .eq('id', actionPlanId)
    .maybeSingle();
  if (planError) throw planError;
  if (!plan) throw new Error('Action plan not found');

  const events = dedupeEvents(await fetchCalendarEvents(supabase, userId, 'action_plan_id', [actionPlanId]));
  return {
    action_plan_id: actionPlanId,
    action_plan_title: (plan as { title: string | null }).title ?? null,
    calendar_events: events,
  };
}

async function deleteByIn(
  supabase: SupabaseClient,
  userId: string,
  table: string,
  column: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from(table).delete().eq('user_id', userId).in(column, ids);
  if (error) throw error;
}

export async function deleteActionPlanRecords(
  supabase: SupabaseClient,
  userId: string,
  actionPlanIds: string[],
): Promise<void> {
  await deleteByIn(supabase, userId, 'goal_calendar_events', 'action_plan_id', actionPlanIds);
  await deleteByIn(supabase, userId, 'action_plan_tasks', 'action_plan_id', actionPlanIds);
  await deleteByIn(supabase, userId, 'action_plan_goal_links', 'action_plan_id', actionPlanIds);
  await deleteByIn(supabase, userId, 'action_plans', 'id', actionPlanIds);
}

export async function deleteGoalRecords(
  supabase: SupabaseClient,
  userId: string,
  targets: GoalDeletionTargets,
): Promise<void> {
  await deleteActionPlanRecords(supabase, userId, targets.action_plan_ids);
  await deleteByIn(supabase, userId, 'goal_calendar_events', 'goal_id', targets.goal_ids);
  await deleteByIn(supabase, userId, 'action_plan_goal_links', 'goal_id', targets.goal_ids);
  await deleteByIn(supabase, userId, 'action_plan_tasks', 'linked_goal_id', targets.goal_ids);

  if (targets.goal_ids.length > 0) {
    // Drop parent links inside the set first so the bulk delete never trips the
    // self-referential parent_goal_id foreign key.
    const { error: unlinkError } = await supabase
      .from('smart_goals')
      .update({ parent_goal_id: null })
      .eq('user_id', userId)
      .in('id', targets.goal_ids);
    if (unlinkError) throw unlinkError;
    await deleteByIn(supabase, userId, 'smart_goals', 'id', targets.goal_ids);
  }
}
