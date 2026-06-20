import { createReminder } from '@/lib/reminders/reminders';
import { getCalendarDefaultReminders, getCalendarEvents } from '@/lib/google/google-calendar';
import { isCalendarLinkedAccountName } from '@/lib/google/linked-account-kind';
import { getUserEntitlements, isFeatureAllowed } from '@/lib/billing/entitlements';

type GoogleReminder = { minutes?: number | null };
type SupabaseError = { message: string };
type SupabaseLike = { from(table: string): unknown };
type Profile = { user_id: string; briefing_timezone: string | null; notification_language: string | null };
type Account = { id: string; name: string };
type SelectQuery<T> = PromiseLike<{ data: T[] | null; error: SupabaseError | null }> & {
  select(columns: string): SelectQuery<T>;
  eq(column: string, value: unknown): SelectQuery<T>;
};
type MaybeSingleQuery = {
  select(columns: string): MaybeSingleQuery;
  eq(column: string, value: unknown): MaybeSingleQuery;
  maybeSingle(): Promise<{ data: { id: string } | null; error: SupabaseError | null }>;
};

export function resolveCalendarReminderMinutes(
  eventReminders: { useDefault?: boolean | null; overrides?: GoogleReminder[] | null } | null | undefined,
  defaultReminders: GoogleReminder[],
): number[] {
  const candidates = eventReminders?.useDefault ? defaultReminders : eventReminders?.overrides || [];
  return Array.from(new Set(candidates
    .map(reminder => reminder.minutes)
    .filter((minutes): minutes is number => typeof minutes === 'number' && Number.isInteger(minutes) && minutes >= 0)))
    .sort((a, b) => a - b);
}

export async function materializeCalendarWhatsappReminders(
  supabase: SupabaseLike,
  now = new Date(),
): Promise<{ inspected: number; created: number; skipped: number }> {
  const { data: profiles, error } = await (supabase.from('user_profile') as SelectQuery<Profile>)
    .select('user_id, briefing_timezone, notification_language')
    .eq('mirror_calendar_reminders_to_whatsapp', true);
  if (error) throw new Error(error.message);

  let inspected = 0;
  let created = 0;
  let skipped = 0;
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + 24 * 60 * 60000).toISOString();

  for (const profile of profiles || []) {
    const entitlements = await getUserEntitlements(supabase, profile.user_id);
    if (!isFeatureAllowed(entitlements, 'reminders')) continue;
    const { data: linkedAccounts } = await (supabase.from('linked_accounts') as SelectQuery<Account>)
      .select('id, name')
      .eq('user_id', profile.user_id)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .eq('provider', 'google');
    for (const account of (linkedAccounts || []).filter(item => isCalendarLinkedAccountName(item.name))) {
      const authContext = { supabase, user: { id: profile.user_id } };
      const [events, defaults] = await Promise.all([
        getCalendarEvents(account.id, timeMin, timeMax, authContext),
        getCalendarDefaultReminders(account.id, authContext),
      ]);
      for (const event of events) {
        const eventId = event.id;
        const startAt = event.start?.dateTime;
        if (!eventId || !startAt) continue;
        for (const minutes of resolveCalendarReminderMinutes(event.reminders, defaults)) {
          inspected += 1;
          const scheduledFor = new Date(new Date(startAt).getTime() - minutes * 60000);
          if (scheduledFor <= now) continue;
          const dedupeKey = `calendar-pre:${account.id}:${eventId}:${startAt}:${minutes}`;
          const { data: existing } = await (supabase.from('reminders') as MaybeSingleQuery)
            .select('id')
            .eq('user_id', profile.user_id)
            .eq('dedupe_key', dedupeKey)
            .maybeSingle();
          if (existing) {
            skipped += 1;
            continue;
          }
          const message = profile.notification_language === 'en'
            ? `Your event starts in ${minutes} minutes.`
            : `Seu evento começa em ${minutes} minutos.`;
          await createReminder(supabase, profile.user_id, {
            message,
            scheduled_for: scheduledFor.toISOString(),
            timezone: profile.briefing_timezone || 'UTC',
            channel_preference: 'whatsapp',
            source: {
              type: 'calendar_event',
              provider: 'google_calendar',
              id: eventId,
              title: event.summary || 'Untitled Event',
              start_at: startAt,
            },
            created_by: 'system',
            dedupe_key: dedupeKey,
          });
          created += 1;
        }
      }
    }
  }
  return { inspected, created, skipped };
}
