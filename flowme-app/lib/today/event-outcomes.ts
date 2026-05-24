export const EVENT_OUTCOMES = ['pending', 'completed', 'skipped', 'blocked', 'moved', 'incomplete', 'deferred'] as const;
export type EventOutcome = (typeof EVENT_OUTCOMES)[number];

export interface EventOutcomeRow {
  event_id: string;
  outcome: EventOutcome;
  outcome_reason: string | null;
  completed_at: string | null;
  linked_account_id: string | null;
}

type SupabaseLike = { from(table: string): any };

export async function listEventOutcomes(
  supabase: SupabaseLike,
  userId: string,
  eventIds: string[],
): Promise<Map<string, EventOutcomeRow>> {
  if (eventIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('calendar_event_outcomes')
    .select('event_id, outcome, outcome_reason, completed_at, linked_account_id')
    .eq('user_id', userId)
    .in('event_id', eventIds);
  if (error) {
    console.error('[event-outcomes.list] error:', error);
    return new Map();
  }
  const map = new Map<string, EventOutcomeRow>();
  for (const row of data || []) map.set(row.event_id, row as EventOutcomeRow);
  return map;
}

export async function upsertEventOutcome(
  supabase: SupabaseLike,
  userId: string,
  input: { event_id: string; outcome: EventOutcome; outcome_reason?: string | null; linked_account_id?: string | null },
): Promise<EventOutcomeRow | null> {
  if (!EVENT_OUTCOMES.includes(input.outcome)) throw new Error('Invalid outcome');
  if (!input.event_id?.trim()) throw new Error('event_id is required');
  const values = {
    user_id: userId,
    event_id: input.event_id,
    outcome: input.outcome,
    outcome_reason: input.outcome_reason ?? null,
    linked_account_id: input.linked_account_id ?? null,
    completed_at: input.outcome === 'completed' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('calendar_event_outcomes')
    .upsert(values, { onConflict: 'user_id,event_id' })
    .select('event_id, outcome, outcome_reason, completed_at, linked_account_id')
    .single();
  if (error) {
    console.error('[event-outcomes.upsert] error:', error);
    throw new Error(error.message);
  }
  return (data as EventOutcomeRow) || null;
}

export async function clearEventOutcome(
  supabase: SupabaseLike,
  userId: string,
  eventId: string,
): Promise<void> {
  const { error } = await supabase
    .from('calendar_event_outcomes')
    .delete()
    .eq('user_id', userId)
    .eq('event_id', eventId);
  if (error) {
    console.error('[event-outcomes.clear] error:', error);
    throw new Error(error.message);
  }
}
