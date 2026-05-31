import { getCalendarEvents } from '@/lib/google/google-calendar';
import { isCalendarLinkedAccountName } from '@/lib/google/linked-account-kind';
import { sendText } from '@/lib/whatsapp/evolution-client';
import { sendWebPush } from '@/lib/web-push/send';

type CheckinChannel = 'push' | 'whatsapp';
type SupabaseError = { message: string };
type SupabaseLike = { from(table: string): unknown };
type Profile = { user_id: string; notification_language: string | null; post_event_checkin_channels: string[] };
type Account = { id: string; name: string };
type SelectQuery<T> = PromiseLike<{ data: T[] | null; error: SupabaseError | null }> & {
  select(columns: string): SelectQuery<T>;
  eq(column: string, value: unknown): SelectQuery<T>;
};
type MaybeSingleQuery<T> = {
  select(columns: string): MaybeSingleQuery<T>;
  eq(column: string, value: unknown): MaybeSingleQuery<T>;
  maybeSingle(): Promise<{ data: T | null; error: SupabaseError | null }>;
};
type TargetQuery = {
  upsert(values: Record<string, unknown>, options: { onConflict: string }): TargetQuery;
  select(columns: string): TargetQuery;
  single(): Promise<{ data: { token: string } | null; error: SupabaseError | null }>;
};
type UpsertQuery = {
  upsert(values: Record<string, unknown>, options: { onConflict: string }): PromiseLike<{ error: SupabaseError | null }>;
};

export interface PostEventCheckinPrompt {
  source_key: string;
  task_id: string;
  title: string;
  body: string;
  url: string;
}

function supportedChannels(channels: string[]): CheckinChannel[] {
  return channels.filter((channel): channel is CheckinChannel => channel === 'push' || channel === 'whatsapp');
}

export function buildPostEventCheckinPrompt(input: {
  accountId: string;
  eventId: string;
  eventTitle: string;
  endAt: string;
  token: string;
  language?: string | null;
}): PostEventCheckinPrompt {
  const isPt = input.language !== 'en';
  return {
    source_key: `${input.accountId}:${input.eventId}:${input.endAt}`,
    task_id: `calendar_event:${input.eventId}`,
    title: isPt ? 'Você concluiu este compromisso?' : 'Did you complete this commitment?',
    body: input.eventTitle,
    url: `/app/today?focus=${input.token}`,
  };
}

async function sendWhatsappCheckin(supabase: SupabaseLike, userId: string, prompt: PostEventCheckinPrompt) {
  const { data: channel } = await (supabase.from('whatsapp_channels') as MaybeSingleQuery<{ phone: string }>)
    .select('phone')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (!channel?.phone) return { ok: false, error: 'no active whatsapp channel' };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.flow-me.online';
  try {
    await sendText(channel.phone, `${prompt.title}\n${prompt.body}\n\n${appUrl}${prompt.url}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'whatsapp send failed' };
  }
}

export async function deliverPostEventCheckins(
  supabase: SupabaseLike,
  now = new Date(),
): Promise<{ inspected: number; sent: number; failed: number; skipped: number }> {
  const { data: profiles, error } = await (supabase.from('user_profile') as SelectQuery<Profile>)
    .select('user_id, notification_language, post_event_checkin_channels')
    .eq('post_event_checkin_enabled', true);
  if (error) throw new Error(error.message);

  let inspected = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const timeMin = new Date(now.getTime() - 15 * 60000).toISOString();
  const timeMax = now.toISOString();

  for (const profile of profiles || []) {
    const { data: linkedAccounts } = await (supabase.from('linked_accounts') as SelectQuery<Account>)
      .select('id, name')
      .eq('user_id', profile.user_id)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .eq('provider', 'google');
    const accounts = (linkedAccounts || []).filter(account => isCalendarLinkedAccountName(account.name));

    for (const account of accounts) {
      const events = await getCalendarEvents(account.id, timeMin, timeMax, { supabase, user: { id: profile.user_id } });
      for (const event of events) {
        const eventId = event.id;
        const endAt = event.end?.dateTime;
        if (!eventId || !endAt || new Date(endAt) > now) continue;
        inspected += 1;
        const taskId = `calendar_event:${eventId}`;
        const { data: outcome } = await (supabase.from('calendar_event_outcomes') as MaybeSingleQuery<{ id: string }>)
          .select('id')
          .eq('user_id', profile.user_id)
          .eq('event_id', taskId)
          .maybeSingle();
        if (outcome) {
          skipped += 1;
          continue;
        }

        const sourceKey = `${account.id}:${eventId}:${endAt}`;
        const target = supabase.from('notification_targets') as TargetQuery;
        const { data: savedTarget, error: targetError } = await target
          .upsert({
            user_id: profile.user_id,
            target_kind: 'today_task',
            source_key: sourceKey,
            target_payload: { task_id: taskId },
            expires_at: new Date(now.getTime() + 7 * 86400000).toISOString(),
          }, { onConflict: 'user_id,target_kind,source_key' })
          .select('token')
          .single();
        if (targetError || !savedTarget) {
          failed += 1;
          continue;
        }
        const prompt = buildPostEventCheckinPrompt({
          accountId: account.id,
          eventId,
          eventTitle: event.summary || 'Untitled Event',
          endAt,
          token: savedTarget.token,
          language: profile.notification_language,
        });

        for (const channel of supportedChannels(profile.post_event_checkin_channels || [])) {
          const { data: existing } = await (supabase.from('event_checkin_deliveries') as MaybeSingleQuery<{ id: string }>)
            .select('id')
            .eq('user_id', profile.user_id)
            .eq('source_key', prompt.source_key)
            .eq('channel', channel)
            .eq('status', 'sent')
            .maybeSingle();
          if (existing) {
            skipped += 1;
            continue;
          }
          const result = channel === 'push'
            ? await sendWebPush(supabase, profile.user_id, { title: prompt.title, body: prompt.body, url: prompt.url })
            : await sendWhatsappCheckin(supabase, profile.user_id, prompt);
          await (supabase.from('event_checkin_deliveries') as UpsertQuery).upsert({
            user_id: profile.user_id,
            source_key: prompt.source_key,
            channel,
            status: result.ok ? 'sent' : 'failed',
            error: result.error || null,
            sent_at: result.ok ? now.toISOString() : null,
            updated_at: now.toISOString(),
          }, { onConflict: 'user_id,source_key,channel' });
          if (result.ok) sent += 1;
          else failed += 1;
        }
      }
    }
  }
  return { inspected, sent, failed, skipped };
}
