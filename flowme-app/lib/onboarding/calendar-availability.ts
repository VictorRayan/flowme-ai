import { getCalendarEvents } from '@/lib/google/google-calendar';
import { isCalendarLinkedAccountName } from '@/lib/google/linked-account-kind';

type BusyRange = { startMin: number; endMin: number; title: string };

interface CachedAvailability {
  expires: number;
  text: string;
}

const cache = new Map<string, CachedAvailability>();
const CACHE_TTL_MS = 10 * 60 * 1000;

const WEEKDAY_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const WEEKDAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function mergeRanges(ranges: BusyRange[]): BusyRange[] {
  if (ranges.length <= 1) return ranges;
  const sorted = [...ranges].sort((a, b) => a.startMin - b.startMin);
  const merged: BusyRange[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const last = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, cur.endMin);
      if (cur.title && last.title.indexOf(cur.title) === -1) {
        last.title = `${last.title}; ${cur.title}`.slice(0, 80);
      }
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

function isoToMin(iso: string, tz: string): { dayOfWeek: number; startMin: number } | null {
  try {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(dt);
    const map: Record<string, string> = {};
    for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dayOfWeek = dayMap[map.weekday] ?? 0;
    const hourRaw = map.hour === '24' ? 0 : parseInt(map.hour, 10);
    const startMin = hourRaw * 60 + parseInt(map.minute, 10);
    return { dayOfWeek, startMin };
  } catch {
    return null;
  }
}

export function clearAvailabilityCache(userId?: string): void {
  if (userId) cache.delete(userId);
  else cache.clear();
}

export async function getCalendarAvailabilityText(
  supabase: any,
  userId: string,
  timezone: string,
  lang: 'pt' | 'en' = 'pt',
  daysAhead = 14,
): Promise<string> {
  const cached = cache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.text;

  const { data: rawAccounts } = await supabase
    .from('linked_accounts')
    .select('id, name, type, provider')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .eq('provider', 'google');

  const accounts = (rawAccounts || []).filter((a: any) => isCalendarLinkedAccountName(a.name));
  if (accounts.length === 0) return '';

  const now = new Date();
  const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const byDay: Record<number, BusyRange[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

  for (const account of accounts) {
    let events: any[] = [];
    try {
      events = await getCalendarEvents(account.id, now.toISOString(), end.toISOString());
    } catch {
      continue;
    }
    for (const event of events) {
      const startIso = event.start?.dateTime;
      const endIso = event.end?.dateTime;
      if (!startIso || !endIso) continue;
      const startInfo = isoToMin(startIso, timezone);
      const endInfo = isoToMin(endIso, timezone);
      if (!startInfo || !endInfo) continue;
      const endMin = endInfo.dayOfWeek === startInfo.dayOfWeek ? endInfo.startMin : 24 * 60;
      if (endMin <= startInfo.startMin) continue;
      byDay[startInfo.dayOfWeek].push({
        startMin: startInfo.startMin,
        endMin,
        title: String(event.summary || 'Compromisso').slice(0, 40),
      });
    }
  }

  const dayNames = lang === 'pt' ? WEEKDAY_PT : WEEKDAY_EN;
  const lines: string[] = [];
  for (let day = 0; day < 7; day += 1) {
    const merged = mergeRanges(byDay[day]);
    if (merged.length === 0) continue;
    const ranges = merged.slice(0, 8).map((r) => `${fmt(r.startMin)}-${fmt(r.endMin)} (${r.title})`).join('; ');
    lines.push(`- ${dayNames[day]}: ${ranges}`);
  }

  if (lines.length === 0) {
    const blank = lang === 'pt'
      ? 'A agenda do usuário está livre nas próximas duas semanas.'
      : "The user's calendar is free for the next two weeks.";
    cache.set(userId, { expires: Date.now() + CACHE_TTL_MS, text: blank });
    return blank;
  }

  const header = lang === 'pt'
    ? 'Horários JÁ OCUPADOS na agenda real do usuário nas próximas 2 semanas (evite propor sobreposição):'
    : "Slots ALREADY BUSY on the user's real calendar over the next 2 weeks (avoid overlap):";
  const rule = lang === 'pt'
    ? 'REGRA: se o horário que o usuário pedir colidir com algum desses, NÃO PROPONHA IMEDIATAMENTE — ofereça duas opções: 1) agendar em outro horário livre, ou 2) realocar o compromisso existente (fale qual é o nome do compromisso) para liberar espaço.'
    : 'RULE: if the user picks a colliding time, DO NOT PROPOSE IMMEDIATELY — offer two options: 1) schedule at another free time, or 2) relocate the existing event (name the event) to free up space.';

  const text = `\n\n## USER CALENDAR BUSY SLOTS\n${header}\n${lines.join('\n')}\n${rule}`;
  cache.set(userId, { expires: Date.now() + CACHE_TTL_MS, text });
  return text;
}
