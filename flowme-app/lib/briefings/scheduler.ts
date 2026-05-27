import type { BriefingSlot } from './types';

type SupabaseLike = { from(table: string): any };

export interface BriefingUser {
  user_id: string;
  morning_briefing_time: string | null;
  afternoon_briefing_time: string | null;
  evening_briefing_time: string | null;
  briefing_timezone: string | null;
  news_topics: string[];
  briefing_delivery: string[];
  briefing_city: string | null;
}

export interface DueSlot {
  user: BriefingUser;
  slot: BriefingSlot;
  briefing_date: string;
}

function minutesIn(time: string | null): number | null {
  if (!time) return null;
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function nowInTimezone(timezone: string): { hours: number; minutes: number; date: string } {
  const probe = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(probe);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
  const hours = parseInt(map.hour === '24' ? '0' : map.hour, 10);
  const minutes = parseInt(map.minute, 10);
  const date = `${map.year}-${map.month}-${map.day}`;
  return { hours, minutes, date };
}

// We trigger generation 3 minutes before the configured slot time
// so the card is warm when the user opens it.
const PREGEN_OFFSET_MIN = 3;

function isSlotDue(slotTime: string | null, nowMinutes: number): boolean {
  const target = minutesIn(slotTime);
  if (target === null) return false;
  const trigger = (target - PREGEN_OFFSET_MIN + 24 * 60) % (24 * 60);
  // Allow a 2-minute window so a cron tick that fires every minute does not miss it
  return Math.abs(trigger - nowMinutes) <= 1;
}

export async function findDueSlots(
  supabase: SupabaseLike,
): Promise<DueSlot[]> {
  const { data, error } = await supabase
    .from('user_profile')
    .select('user_id, morning_briefing_time, afternoon_briefing_time, evening_briefing_time, briefing_timezone, news_topics, briefing_delivery, briefing_city')
    .eq('daily_routine_enabled', true);
  if (error) {
    console.error('[scheduler.findDueSlots] error:', error);
    return [];
  }
  const due: DueSlot[] = [];
  for (const row of (data as any[]) || []) {
    const user: BriefingUser = {
      user_id: row.user_id,
      morning_briefing_time: row.morning_briefing_time,
      afternoon_briefing_time: row.afternoon_briefing_time,
      evening_briefing_time: row.evening_briefing_time,
      briefing_timezone: row.briefing_timezone,
      news_topics: row.news_topics || [],
      briefing_delivery: row.briefing_delivery || ['web'],
      briefing_city: row.briefing_city,
    };
    const tz = user.briefing_timezone || 'UTC';
    const localNow = nowInTimezone(tz);
    const minutesNow = localNow.hours * 60 + localNow.minutes;
    if (isSlotDue(user.morning_briefing_time, minutesNow)) {
      due.push({ user, slot: 'morning', briefing_date: localNow.date });
    }
    if (isSlotDue(user.afternoon_briefing_time, minutesNow)) {
      due.push({ user, slot: 'afternoon', briefing_date: localNow.date });
    }
    if (isSlotDue(user.evening_briefing_time, minutesNow)) {
      due.push({ user, slot: 'evening', briefing_date: localNow.date });
    }
  }
  return due;
}

export { isSlotDue, minutesIn, nowInTimezone };
