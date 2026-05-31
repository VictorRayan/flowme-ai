import { sendText } from '@/lib/whatsapp/evolution-client';
import { sendWebPush } from '@/lib/web-push/send';

export type RitualKind = 'daily_briefing_note' | 'weekly_review';
export type RitualChannel = 'push' | 'whatsapp';

export interface RitualProfile {
  user_id: string;
  briefing_timezone: string | null;
  notification_language: string | null;
  daily_briefing_note_prompt_enabled: boolean;
  daily_briefing_note_time: string | null;
  daily_briefing_note_channels: string[];
  weekly_review_enabled: boolean;
  weekly_review_weekday: number;
  weekly_review_time: string | null;
  weekly_review_channels: string[];
}

export interface RitualPrompt {
  user_id: string;
  ritual_kind: RitualKind;
  occurrence_key: string;
  channels: RitualChannel[];
  title: string;
  body: string;
  url: string;
}

type SupabaseError = { message: string };
type SupabaseLike = { from(table: string): unknown };
type ProfileQuery = PromiseLike<{ data: RitualProfile[] | null; error: SupabaseError | null }> & {
  select(columns: string): ProfileQuery;
};
type ExistingQuery = {
  select(columns: string): ExistingQuery;
  eq(column: string, value: unknown): ExistingQuery;
  maybeSingle(): Promise<{ data: { id: string } | null; error: SupabaseError | null }>;
};
type UpsertQuery = {
  upsert(values: Record<string, unknown>, options: { onConflict: string }): PromiseLike<{ error: SupabaseError | null }>;
};
type WhatsappQuery = {
  select(columns: string): WhatsappQuery;
  eq(column: string, value: unknown): WhatsappQuery;
  maybeSingle(): Promise<{ data: { phone: string } | null; error: SupabaseError | null }>;
};

function minutesIn(time: string | null): number | null {
  if (!time) return null;
  const match = time.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function localClock(now: Date, timezone: string): { date: string; minutes: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const map = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  const date = `${map.year}-${map.month}-${map.day}`;
  return { date, minutes: Number(map.hour) * 60 + Number(map.minute), weekday: new Date(`${date}T12:00:00Z`).getUTCDay() };
}

function due(time: string | null, nowMinutes: number): boolean {
  const target = minutesIn(time);
  return target !== null && Math.abs(target - nowMinutes) <= 1;
}

function supportedChannels(channels: string[]): RitualChannel[] {
  return channels.filter((channel): channel is RitualChannel => channel === 'push' || channel === 'whatsapp');
}

export function buildRitualPrompts(profile: RitualProfile, now: Date): RitualPrompt[] {
  const clock = localClock(now, profile.briefing_timezone || 'UTC');
  const isPt = profile.notification_language !== 'en';
  const prompts: RitualPrompt[] = [];

  if (profile.daily_briefing_note_prompt_enabled && due(profile.daily_briefing_note_time, clock.minutes)) {
    prompts.push({
      user_id: profile.user_id,
      ritual_kind: 'daily_briefing_note',
      occurrence_key: clock.date,
      channels: supportedChannels(profile.daily_briefing_note_channels),
      title: isPt ? 'Hora do seu daily briefing' : 'Time for your daily briefing',
      body: isPt ? 'Registre como foi o seu dia por texto ou áudio.' : 'Write or record how your day went.',
      url: `/app/notes?daily_briefing=${clock.date}&focus=editor`,
    });
  }

  if (profile.weekly_review_enabled && profile.weekly_review_weekday === clock.weekday && due(profile.weekly_review_time, clock.minutes)) {
    const message = isPt ? 'Iniciar Revisão semanal' : 'Start Weekly Review';
    prompts.push({
      user_id: profile.user_id,
      ritual_kind: 'weekly_review',
      occurrence_key: clock.date,
      channels: supportedChannels(profile.weekly_review_channels),
      title: isPt ? 'Hora da sua Revisão semanal' : 'Time for your Weekly Review',
      body: isPt ? 'Abra a Balys para revisar sua semana.' : 'Open Balys to review your week.',
      url: `/app/ai?prompt=${encodeURIComponent(message)}&autofocus=1`,
    });
  }

  return prompts;
}

async function sendWhatsappPrompt(supabase: SupabaseLike, userId: string, prompt: RitualPrompt): Promise<{ ok: boolean; error?: string }> {
  const { data: channel } = await (supabase.from('whatsapp_channels') as WhatsappQuery)
    .select('phone')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (!channel?.phone) return { ok: false, error: 'no active whatsapp channel' };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.flow-me.online';
  try {
    await sendText(channel.phone, `${prompt.body}\n\n${appUrl}${prompt.url}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'whatsapp send failed' };
  }
}

export async function deliverDueRitualPrompts(
  supabase: SupabaseLike,
  now = new Date(),
): Promise<{ inspected: number; sent: number; failed: number; skipped: number }> {
  const { data: profiles, error } = await (supabase.from('user_profile') as ProfileQuery)
    .select('user_id, briefing_timezone, notification_language, daily_briefing_note_prompt_enabled, daily_briefing_note_time, daily_briefing_note_channels, weekly_review_enabled, weekly_review_weekday, weekly_review_time, weekly_review_channels');
  if (error) throw new Error(error.message);

  const prompts = (profiles || []).flatMap(profile => buildRitualPrompts(profile, now));
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const prompt of prompts) {
    for (const channel of prompt.channels) {
      const { data: existing } = await (supabase.from('ritual_prompt_deliveries') as ExistingQuery)
        .select('id')
        .eq('user_id', prompt.user_id)
        .eq('ritual_kind', prompt.ritual_kind)
        .eq('occurrence_key', prompt.occurrence_key)
        .eq('channel', channel)
        .eq('status', 'sent')
        .maybeSingle();
      if (existing) {
        skipped += 1;
        continue;
      }

      const result = channel === 'push'
        ? await sendWebPush(supabase, prompt.user_id, { title: prompt.title, body: prompt.body, url: prompt.url })
        : await sendWhatsappPrompt(supabase, prompt.user_id, prompt);
      const status = result.ok ? 'sent' : 'failed';
      await (supabase.from('ritual_prompt_deliveries') as UpsertQuery).upsert({
        user_id: prompt.user_id,
        ritual_kind: prompt.ritual_kind,
        occurrence_key: prompt.occurrence_key,
        channel,
        status,
        error: result.error || null,
        sent_at: result.ok ? now.toISOString() : null,
        updated_at: now.toISOString(),
      }, { onConflict: 'user_id,ritual_kind,occurrence_key,channel' });
      if (result.ok) sent += 1;
      else failed += 1;
    }
  }

  return { inspected: prompts.length, sent, failed, skipped };
}

export { due as isRitualDue };
