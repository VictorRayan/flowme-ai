export type CalendarMovementType = 'postponed' | 'advanced' | 'unchanged';
export type CalendarRescheduleActor = 'user_ui' | 'balys' | 'batch_replan' | 'google_external' | 'system';

export interface CalendarRescheduleCalculation {
  offset_minutes: number;
  total_offset_minutes: number;
  movement_type: CalendarMovementType;
  minutes_before_previous_start: number;
}

export interface RecordCalendarRescheduleInput {
  user_id: string;
  linked_account_id: string;
  provider_event_id: string;
  event_title: string;
  previous_start_at: string;
  previous_end_at?: string | null;
  new_start_at: string;
  new_end_at?: string | null;
  changed_by: CalendarRescheduleActor;
  changed_at?: string;
  source_context?: Record<string, unknown>;
}

export interface CalendarRescheduleRow extends CalendarRescheduleCalculation {
  id: string;
  provider_event_id: string;
  event_title: string;
  initial_start_at: string;
  initial_end_at: string | null;
  previous_start_at: string;
  previous_end_at: string | null;
  new_start_at: string;
  new_end_at: string | null;
  changed_by: CalendarRescheduleActor;
  changed_at: string;
}

interface SnapshotRow {
  initial_start_at: string;
  initial_end_at: string | null;
}

type SupabaseError = { message: string };
type SnapshotQuery = {
  select(columns: string): SnapshotQuery;
  eq(column: string, value: unknown): SnapshotQuery;
  maybeSingle(): Promise<{ data: SnapshotRow | null; error: SupabaseError | null }>;
};
type UpsertQuery = {
  upsert(values: Record<string, unknown>, options?: { onConflict?: string }): PromiseLike<{ error: SupabaseError | null }>;
};
type InsertQuery = {
  insert(values: Record<string, unknown>): PromiseLike<{ error: SupabaseError | null }>;
};
type ListQuery = PromiseLike<{ data: CalendarRescheduleRow[] | null; error: SupabaseError | null }> & {
  select(columns: string): ListQuery;
  eq(column: string, value: unknown): ListQuery;
  gte(column: string, value: unknown): ListQuery;
  lte(column: string, value: unknown): ListQuery;
  order(column: string, options: { ascending: boolean }): ListQuery;
  limit(count: number): ListQuery;
};
type SupabaseLike = { from(table: string): unknown };

function diffMinutes(later: string, earlier: string): number {
  return Math.round((new Date(later).getTime() - new Date(earlier).getTime()) / 60000);
}

export function calculateCalendarReschedule(
  initialStartAt: string,
  previousStartAt: string,
  newStartAt: string,
  changedAt: string,
): CalendarRescheduleCalculation {
  const offset = diffMinutes(newStartAt, previousStartAt);
  return {
    offset_minutes: offset,
    total_offset_minutes: diffMinutes(newStartAt, initialStartAt),
    movement_type: offset > 0 ? 'postponed' : offset < 0 ? 'advanced' : 'unchanged',
    minutes_before_previous_start: diffMinutes(previousStartAt, changedAt),
  };
}

export async function recordCalendarReschedule(
  supabase: SupabaseLike,
  input: RecordCalendarRescheduleInput,
): Promise<void> {
  if (input.previous_start_at === input.new_start_at && input.previous_end_at === input.new_end_at) return;

  const snapshotQuery = supabase.from('calendar_event_snapshots') as SnapshotQuery;
  const { data: snapshot, error: snapshotError } = await snapshotQuery
    .select('initial_start_at, initial_end_at')
    .eq('user_id', input.user_id)
    .eq('linked_account_id', input.linked_account_id)
    .eq('provider_event_id', input.provider_event_id)
    .maybeSingle();
  if (snapshotError) throw new Error(snapshotError.message);

  const changedAt = input.changed_at || new Date().toISOString();
  const initialStartAt = snapshot?.initial_start_at || input.previous_start_at;
  const initialEndAt = snapshot?.initial_end_at ?? input.previous_end_at ?? null;
  const calculation = calculateCalendarReschedule(initialStartAt, input.previous_start_at, input.new_start_at, changedAt);

  const insertQuery = supabase.from('calendar_event_reschedules') as InsertQuery;
  const { error: insertError } = await insertQuery.insert({
    user_id: input.user_id,
    linked_account_id: input.linked_account_id,
    provider_event_id: input.provider_event_id,
    event_title: input.event_title,
    initial_start_at: initialStartAt,
    initial_end_at: initialEndAt,
    previous_start_at: input.previous_start_at,
    previous_end_at: input.previous_end_at ?? null,
    new_start_at: input.new_start_at,
    new_end_at: input.new_end_at ?? null,
    changed_by: input.changed_by,
    changed_at: changedAt,
    source_context: input.source_context || {},
    ...calculation,
  });
  if (insertError) throw new Error(insertError.message);

  const upsertQuery = supabase.from('calendar_event_snapshots') as UpsertQuery;
  const { error: snapshotUpsertError } = await upsertQuery.upsert({
    user_id: input.user_id,
    linked_account_id: input.linked_account_id,
    provider_event_id: input.provider_event_id,
    event_title: input.event_title,
    initial_start_at: initialStartAt,
    initial_end_at: initialEndAt,
    current_start_at: input.new_start_at,
    current_end_at: input.new_end_at ?? null,
    observed_at: changedAt,
    updated_at: changedAt,
  }, { onConflict: 'user_id,linked_account_id,provider_event_id' });
  if (snapshotUpsertError) throw new Error(snapshotUpsertError.message);
}

export async function listCalendarReschedules(
  supabase: SupabaseLike,
  userId: string,
  filters: { from?: string | null; to?: string | null; limit?: number } = {},
): Promise<CalendarRescheduleRow[]> {
  let query = (supabase.from('calendar_event_reschedules') as ListQuery)
    .select('id, provider_event_id, event_title, initial_start_at, initial_end_at, previous_start_at, previous_end_at, new_start_at, new_end_at, offset_minutes, total_offset_minutes, movement_type, minutes_before_previous_start, changed_by, changed_at')
    .eq('user_id', userId)
    .order('changed_at', { ascending: false })
    .limit(Math.min(filters.limit || 100, 250));
  if (filters.from) query = query.gte('changed_at', filters.from);
  if (filters.to) query = query.lte('changed_at', filters.to);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}
