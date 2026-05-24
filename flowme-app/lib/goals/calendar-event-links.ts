import type { SupabaseClient } from '@supabase/supabase-js';

export type GoalCalendarEventStatus = 'active' | 'deleted' | 'rescheduled' | 'moved';
export type GoalCalendarEventDeletionSource = 'calendar_ui' | 'balys' | 'api' | 'unknown';

export type GoalCalendarEventLinkInput = {
  linked_account_id: string;
  provider_event_id: string;
  action_plan_id: string;
  goal_id: string;
  title: string;
  scheduled_date: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  plan_day?: number | null;
  sort_order?: number | null;
};

export type DeletedGoalCalendarEvent = {
  id: string;
  provider_event_id: string;
  linked_account_id: string;
  action_plan_id: string | null;
  goal_id: string | null;
  title: string;
  scheduled_date: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  plan_day: number | null;
  sort_order: number | null;
  status: GoalCalendarEventStatus;
  deletion_source: GoalCalendarEventDeletionSource | null;
  deletion_note: string | null;
  deleted_at: string | null;
};

const GOAL_EVENT_FIELDS = `
  id, provider_event_id, linked_account_id, action_plan_id, goal_id, title,
  scheduled_date, start_at, end_at, duration_minutes, plan_day, sort_order,
  status, deletion_source, deletion_note, deleted_at
`;

export async function recordGoalCalendarEventLinks(
  supabase: SupabaseClient,
  userId: string,
  links: GoalCalendarEventLinkInput[],
) {
  if (links.length === 0) return { inserted: 0 };

  const rows = links.map(link => ({
    user_id: userId,
    linked_account_id: link.linked_account_id,
    provider_event_id: link.provider_event_id,
    action_plan_id: link.action_plan_id,
    goal_id: link.goal_id,
    title: link.title,
    scheduled_date: link.scheduled_date,
    start_at: link.start_at,
    end_at: link.end_at,
    duration_minutes: link.duration_minutes,
    plan_day: link.plan_day ?? null,
    sort_order: link.sort_order ?? null,
    status: 'active',
  }));

  const { error } = await supabase.from('goal_calendar_events').upsert(rows, {
    onConflict: 'user_id,linked_account_id,provider_event_id',
  });

  if (error) throw error;
  return { inserted: rows.length };
}

export async function markGoalCalendarEventDeleted(
  supabase: SupabaseClient,
  userId: string,
  input: {
    linkedAccountId: string;
    providerEventId: string;
    deletionSource: GoalCalendarEventDeletionSource;
    deletionNote?: string | null;
  },
): Promise<{ matched: number; needs_replan: boolean; deleted_events: DeletedGoalCalendarEvent[] }> {
  const { data, error } = await supabase
    .from('goal_calendar_events')
    .update({
      status: 'deleted',
      deletion_source: input.deletionSource,
      deletion_note: input.deletionNote || null,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('linked_account_id', input.linkedAccountId)
    .eq('provider_event_id', input.providerEventId)
    .select(GOAL_EVENT_FIELDS);

  if (error) throw error;
  const deletedEvents = (data || []) as DeletedGoalCalendarEvent[];
  return {
    matched: deletedEvents.length,
    needs_replan: deletedEvents.length > 0,
    deleted_events: deletedEvents,
  };
}

export async function listDeletedGoalCalendarEvents(
  supabase: SupabaseClient,
  userId: string,
  limit = 20,
): Promise<DeletedGoalCalendarEvent[]> {
  const { data, error } = await supabase
    .from('goal_calendar_events')
    .select(GOAL_EVENT_FIELDS)
    .eq('user_id', userId)
    .eq('status', 'deleted')
    .order('scheduled_date', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data || []) as DeletedGoalCalendarEvent[];
}
