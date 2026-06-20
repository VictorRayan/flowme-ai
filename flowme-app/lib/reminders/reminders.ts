import { createWhatsappReminderProvider } from './whatsapp-provider';
import { resolveReminderProvider } from './providers';
import { getUserEntitlements, isFeatureAllowed } from '@/lib/billing/entitlements';
import type {
  CreateReminderInput,
  ListRemindersFilters,
  ReminderChannelPreference,
  ReminderCreatedBy,
  ReminderProviderName,
  ReminderRecord,
  ReminderStatus,
} from './types';

type SupabaseError = { message: string };
type AwaitableResult<T> = PromiseLike<{ data: T; error: SupabaseError | null }>;
type SingleQuery<T> = {
  select(columns: string): SingleQuery<T>;
  eq(column: string, value: unknown): SingleQuery<T>;
  single(): Promise<{ data: T | null; error: SupabaseError | null }>;
};
type MaybeSingleQuery<T> = {
  select(columns: string): MaybeSingleQuery<T>;
  eq(column: string, value: unknown): MaybeSingleQuery<T>;
  maybeSingle(): Promise<{ data: T | null; error: SupabaseError | null }>;
};
type SelectQuery<T> = AwaitableResult<T[]> & {
  select(columns: string): SelectQuery<T>;
  eq(column: string, value: unknown): SelectQuery<T>;
  gte(column: string, value: unknown): SelectQuery<T>;
  lte(column: string, value: unknown): SelectQuery<T>;
  order(column: string, options?: { ascending?: boolean }): SelectQuery<T>;
  limit(count: number): SelectQuery<T>;
};
type InsertQuery<T> = {
  insert(values: Record<string, unknown> | Record<string, unknown>[]): InsertQuery<T>;
  select(columns: string): InsertQuery<T>;
  single(): Promise<{ data: T | null; error: SupabaseError | null }>;
};
type UpdateQuery<T> = AwaitableResult<T[]> & {
  update(values: Record<string, unknown>): UpdateQuery<T>;
  eq(column: string, value: unknown): UpdateQuery<T>;
  select(columns: string): UpdateQuery<T>;
  single(): Promise<{ data: T | null; error: SupabaseError | null }>;
};
type SupabaseLike = {
  from(table: string): unknown;
};

const REMINDER_COLUMNS = 'id, user_id, title, message, scheduled_for, timezone, status, channel_preference, source_type, source_provider, source_id, source_title, source_start_at, created_by, dedupe_key, created_at, updated_at';
const CHANNELS: ReminderChannelPreference[] = ['default', 'whatsapp', 'instagram', 'push'];
const STATUSES: ReminderStatus[] = ['scheduled', 'sent', 'cancelled', 'failed'];
const CREATORS: ReminderCreatedBy[] = ['balys', 'user', 'system'];

function timezoneOffsetMs(timezone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  const hour = map.hour === '24' ? 0 : parseInt(map.hour, 10);
  const localUtc = Date.UTC(parseInt(map.year, 10), parseInt(map.month, 10) - 1, parseInt(map.day, 10), hour, parseInt(map.minute, 10), parseInt(map.second, 10));
  return localUtc - date.getTime();
}

// When the model passes a wall-clock time with `Z` (UTC) but also says the user
// is in a non-UTC timezone, treat the wall-clock as the user's local time —
// "10:00" + tz "America/Sao_Paulo" should fire at 10 BRT, not 10 UTC.
export function normalizeScheduledFor(scheduledFor: string, timezone: string | undefined): string {
  const parsed = new Date(scheduledFor);
  if (Number.isNaN(parsed.getTime())) return scheduledFor;
  if (!timezone || timezone === 'UTC') return parsed.toISOString();
  const looksLikeUtc = /Z$|[+-]00:?00$/.test(scheduledFor.trim());
  if (!looksLikeUtc) return parsed.toISOString();
  try {
    const offset = timezoneOffsetMs(timezone, parsed);
    if (offset === 0) return parsed.toISOString();
    return new Date(parsed.getTime() - offset).toISOString();
  } catch {
    return parsed.toISOString();
  }
}

export function validateReminderInput(input: CreateReminderInput): string | null {
  if (!input.message?.trim()) return 'message is required';
  if (input.message.trim().length > 1000) return 'message must be at most 1000 characters';
  const scheduledFor = new Date(input.scheduled_for);
  if (!input.scheduled_for || Number.isNaN(scheduledFor.getTime())) return 'scheduled_for must be a valid ISO datetime';
  const channel = input.channel_preference || 'default';
  if (!CHANNELS.includes(channel)) return 'channel_preference is invalid';
  const createdBy = input.created_by || 'balys';
  if (!CREATORS.includes(createdBy)) return 'created_by is invalid';
  if (input.source) {
    if (input.source.type !== 'calendar_event') return 'source.type is invalid';
    if (input.source.provider !== 'google_calendar') return 'source.provider is invalid';
    if (!input.source.id?.trim()) return 'source.id is required';
  }
  return null;
}

export async function createReminder(
  supabase: SupabaseLike,
  userId: string,
  input: CreateReminderInput,
): Promise<ReminderRecord> {
  const validationError = validateReminderInput(input);
  if (validationError) throw new Error(validationError);

  const timezone = input.timezone?.trim() || 'UTC';
  const values = {
    user_id: userId,
    title: input.title?.trim() || null,
    message: input.message.trim(),
    scheduled_for: normalizeScheduledFor(input.scheduled_for, timezone),
    timezone,
    channel_preference: input.channel_preference || 'default',
    source_type: input.source?.type || null,
    source_provider: input.source?.provider || null,
    source_id: input.source?.id || null,
    source_title: input.source?.title || null,
    source_start_at: input.source?.start_at ? new Date(input.source.start_at).toISOString() : null,
    created_by: input.created_by || 'balys',
    dedupe_key: input.dedupe_key || null,
  };

  const query = supabase.from('reminders') as InsertQuery<ReminderRecord>;
  const { data, error } = await query.insert(values).select(REMINDER_COLUMNS).single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Reminder was not created');
  return data;
}

export async function listReminders(
  supabase: SupabaseLike,
  userId: string,
  filters: ListRemindersFilters = {},
): Promise<ReminderRecord[]> {
  let query = (supabase.from('reminders') as SelectQuery<ReminderRecord>)
    .select(REMINDER_COLUMNS)
    .eq('user_id', userId)
    .order('scheduled_for', { ascending: true })
    .limit(filters.limit || 50);

  if (filters.status) {
    if (!STATUSES.includes(filters.status)) throw new Error('status is invalid');
    query = query.eq('status', filters.status);
  }
  if (filters.source_type) query = query.eq('source_type', filters.source_type);
  if (filters.source_id) query = query.eq('source_id', filters.source_id);
  if (filters.start_iso) query = query.gte('scheduled_for', filters.start_iso);
  if (filters.end_iso) query = query.lte('scheduled_for', filters.end_iso);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function updateReminder(
  supabase: SupabaseLike,
  userId: string,
  reminderId: string,
  values: Partial<Pick<CreateReminderInput, 'message' | 'scheduled_for' | 'timezone' | 'channel_preference'>>,
): Promise<ReminderRecord> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (values.message !== undefined) {
    if (!values.message.trim()) throw new Error('message is required');
    patch.message = values.message.trim();
  }
  if (values.timezone !== undefined) patch.timezone = values.timezone?.trim() || 'UTC';
  if (values.scheduled_for !== undefined) {
    const scheduledFor = new Date(values.scheduled_for);
    if (Number.isNaN(scheduledFor.getTime())) throw new Error('scheduled_for must be a valid ISO datetime');
    patch.scheduled_for = normalizeScheduledFor(values.scheduled_for, (patch.timezone as string | undefined) || undefined);
  }
  if (values.channel_preference !== undefined) {
    if (!CHANNELS.includes(values.channel_preference)) throw new Error('channel_preference is invalid');
    patch.channel_preference = values.channel_preference;
  }
  if (Object.keys(patch).length === 1) throw new Error('No fields to update');

  const query = supabase.from('reminders') as UpdateQuery<ReminderRecord>;
  const { data, error } = await query
    .update(patch)
    .eq('id', reminderId)
    .eq('user_id', userId)
    .eq('status', 'scheduled')
    .select(REMINDER_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Reminder not found');
  return data;
}

export async function cancelReminder(supabase: SupabaseLike, userId: string, reminderId: string): Promise<void> {
  const query = supabase.from('reminders') as UpdateQuery<ReminderRecord>;
  const { error } = await query
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', reminderId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

type DeliveryRecord = {
  id: string;
  status: string;
};

type DueReminder = ReminderRecord & {
  channel_preference: ReminderChannelPreference;
};

function createUnsupportedProvider(provider: ReminderProviderName) {
  return {
    name: provider,
    async send() {
      throw new Error(`${provider} reminder provider is not configured yet.`);
    },
  };
}

function buildReminderMessage(reminder: ReminderRecord): string {
  if (reminder.source_title) return `${reminder.message}\n\nEvento: ${reminder.source_title}`;
  return reminder.message;
}

export async function sendDueReminders(
  supabase: SupabaseLike,
  nowIso = new Date().toISOString(),
  limit = 50,
): Promise<{ inspected: number; sent: number; failed: number; skipped: number }> {
  const dueQuery = (supabase.from('reminders') as SelectQuery<DueReminder>)
    .select(REMINDER_COLUMNS)
    .eq('status', 'scheduled')
    .lte('scheduled_for', nowIso)
    .order('scheduled_for', { ascending: true })
    .limit(limit);

  const { data: reminders, error } = await dueQuery;
  if (error) throw new Error(error.message);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const reminder of reminders || []) {
    const entitlements = await getUserEntitlements(supabase, reminder.user_id);
    if (!isFeatureAllowed(entitlements, 'reminders')) {
      skipped++;
      continue;
    }
    const providerName = resolveReminderProvider(reminder.channel_preference);
    const existingQuery = supabase.from('reminder_deliveries') as MaybeSingleQuery<DeliveryRecord>;
    const { data: existingSent } = await existingQuery
      .select('id, status')
      .eq('reminder_id', reminder.id)
      .eq('provider', providerName)
      .eq('status', 'sent')
      .maybeSingle();

    if (existingSent) {
      await (supabase.from('reminders') as UpdateQuery<ReminderRecord>)
        .update({ status: 'sent', updated_at: new Date().toISOString() })
        .eq('id', reminder.id);
      skipped++;
      continue;
    }

    const provider = providerName === 'whatsapp'
      ? createWhatsappReminderProvider(supabase)
      : createUnsupportedProvider(providerName);

    const deliveryInsert = supabase.from('reminder_deliveries') as InsertQuery<DeliveryRecord>;
    const { data: delivery } = await deliveryInsert.insert({
      reminder_id: reminder.id,
      user_id: reminder.user_id,
      provider: providerName,
      status: 'pending',
      attempt: 1,
      scheduled_for: reminder.scheduled_for,
    }).select('id, status').single();

    try {
      const result = await provider.send({
        userId: reminder.user_id,
        reminderId: reminder.id,
        message: buildReminderMessage(reminder),
        scheduledFor: reminder.scheduled_for,
      });

      if (delivery?.id) {
        await (supabase.from('reminder_deliveries') as UpdateQuery<DeliveryRecord>)
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider_message_id: result.providerMessageId || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', delivery.id);
      }
      await (supabase.from('reminders') as UpdateQuery<ReminderRecord>)
        .update({ status: 'sent', updated_at: new Date().toISOString() })
        .eq('id', reminder.id);
      sent++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send reminder';
      if (delivery?.id) {
        await (supabase.from('reminder_deliveries') as UpdateQuery<DeliveryRecord>)
          .update({ status: 'failed', error: message, updated_at: new Date().toISOString() })
          .eq('id', delivery.id);
      }
      await (supabase.from('reminders') as UpdateQuery<ReminderRecord>)
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', reminder.id);
      failed++;
    }
  }

  return { inspected: reminders?.length || 0, sent, failed, skipped };
}
