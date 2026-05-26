import { weatherGetTool } from '@/lib/ai/tools/weather-tools';
import { calendarListEventsTool } from '@/lib/ai/tools/calendar-tools';
import { summarizeTitle } from '@/lib/goals/planner';
import { webGroundedSearchTool } from '@/lib/ai/tools/web-tools';
import { trendsFromTopicsTool } from '@/lib/ai/tools/trends-tools';
import type { ToolContext } from '@/lib/ai/tools/Tool';
import type {
  BriefingSectionResult,
  BriefingSections,
  CalendarEventLite,
  CalendarSection,
  GoalSection,
  NewsItem,
  NewsSection,
  TrendsSection,
  WeatherSection,
} from './types';

const SECTION_TIMEOUT_MS = 8000;
export const DEFAULT_BRIEFING_TOPICS = ['inteligência artificial', 'produtividade', 'tecnologia'];

function ok<T>(data: T): BriefingSectionResult<T> {
  return { ok: true, data };
}
function fail<T>(error: string): BriefingSectionResult<T> {
  return { ok: false, data: null, error };
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    p.then((value) => { clearTimeout(timer); resolve(value); }, (err) => { clearTimeout(timer); reject(err); });
  });
}

async function weatherSection(ctx: ToolContext, city: string | null | undefined): Promise<BriefingSectionResult<WeatherSection>> {
  if (!city) return fail('Sem cidade configurada');
  try {
    const result: any = await withTimeout(weatherGetTool.call({ city }, ctx), SECTION_TIMEOUT_MS, 'weather');
    if (!result.ok) return fail(result.error || 'Sem dados de clima');
    const r = result.receipt || result.data || {};
    return ok({
      temperature_c: Number(r.temperature_c ?? r.current?.temperature_c ?? 0),
      condition: String(r.condition || r.current?.condition || ''),
      city: String(r.city || city),
    });
  } catch (err: any) {
    return fail(err?.message || 'weather failure');
  }
}

async function calendarSection(ctx: ToolContext, slot: 'morning' | 'evening'): Promise<BriefingSectionResult<CalendarSection>> {
  try {
    const now = new Date();
    const end = new Date(now);
    if (slot === 'morning') {
      end.setHours(23, 59, 59, 999);
    } else {
      end.setDate(end.getDate() + 1);
      end.setHours(23, 59, 59, 999);
    }
    const result: any = await withTimeout(
      calendarListEventsTool.call({ start_iso: now.toISOString(), end_iso: end.toISOString(), limit: 10 }, ctx),
      SECTION_TIMEOUT_MS,
      'calendar',
    );
    if (!result.ok) return fail(result.error || 'Sem dados de agenda');
    const rawEvents: any[] = result.receipt?.events || result.data?.events || result.receipt?.items || [];
    const events: CalendarEventLite[] = rawEvents.slice(0, 5).map((e) => ({
      title: summarizeTitle(String(e.title || e.summary || 'Sem título')),
      start_at: String(e.start_at || e.start?.dateTime || e.start?.date || now.toISOString()),
      end_at: e.end_at || e.end?.dateTime || e.end?.date || null,
      location: e.location || null,
    }));
    return ok({ events });
  } catch (err: any) {
    return fail(err?.message || 'calendar failure');
  }
}

async function goalSection(ctx: ToolContext): Promise<BriefingSectionResult<GoalSection>> {
  try {
    const today = dateInTimezone(ctx.nowIso ? new Date(ctx.nowIso) : new Date(), ctx.timezone || 'UTC');
    const { data, error } = await withTimeout<{ data: any[] | null; error: { message?: string } | null }>(
      ctx.supabase
        .from('goal_calendar_events')
        .select('title, status, start_at, duration_minutes')
        .eq('user_id', ctx.user.id)
        .eq('scheduled_date', today)
        .eq('status', 'active')
        .order('start_at', { ascending: true })
        .limit(1),
      SECTION_TIMEOUT_MS,
      'goal-calendar-events',
    );
    if (error) return fail(error.message || 'Sem meta executável hoje');
    const event = Array.isArray(data) ? data[0] : null;
    if (!event) return fail('Sem meta executável hoje');
    return ok({
      title: summarizeTitle(String(event.title || 'Meta de hoje')),
      status: 'in_progress',
    });
  } catch (err: any) {
    return fail(err?.message || 'goals failure');
  }
}

export function dateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) if (part.type !== 'literal') map[part.type] = part.value;
  return `${map.year}-${map.month}-${map.day}`;
}

async function newsSection(ctx: ToolContext, topics: string[]): Promise<BriefingSectionResult<NewsSection>> {
  const activeTopics = normalizeTopics(topics);
  try {
    const queries = activeTopics.map((t) => `Notícias recentes sobre ${t}`);
    const results = await Promise.allSettled(
      queries.map((q) => withTimeout(webGroundedSearchTool.call({ query: q }, ctx), SECTION_TIMEOUT_MS, `news:${q}`)),
    );

    const by_topic = results.map((settled, idx) => {
      if (settled.status !== 'fulfilled' || !(settled.value as any).ok) {
        return { topic: activeTopics[idx], items: [] as NewsItem[] };
      }
      const value: any = settled.value;
      const answer = String(value.receipt?.answer || '');
      const citations: any[] = value.receipt?.citations || [];
      const items: NewsItem[] = citations.length > 0
        ? citations.slice(0, 3).map((c) => ({
          title: String(c.title || 'Notícia'),
          summary: answer.slice(0, 220),
          url: c.url || null,
          source: hostname(c.url),
        }))
        : answer ? [{ title: activeTopics[idx], summary: answer.slice(0, 260), url: null, source: null }] : [];
      return { topic: activeTopics[idx], items };
    });

    const anyHit = by_topic.some((t) => t.items.length > 0);
    if (!anyHit) return fail('Sem notícias agora');
    return ok({ by_topic });
  } catch (err: any) {
    return fail(err?.message || 'news failure');
  }
}

async function trendsSection(ctx: ToolContext, topics: string[]): Promise<BriefingSectionResult<TrendsSection>> {
  const activeTopics = normalizeTopics(topics);
  try {
    const result: any = await withTimeout(
      trendsFromTopicsTool.call({ topics: activeTopics }, ctx),
      SECTION_TIMEOUT_MS,
      'trends',
    );
    if (result.ok && Array.isArray(result.receipt?.trends) && result.receipt.trends.length > 0) {
      return ok({ trends: result.receipt.trends });
    }
    return await trendsFallbackSection(ctx, activeTopics);
  } catch (err: any) {
    try {
      return await trendsFallbackSection(ctx, activeTopics);
    } catch {
      return fail(err?.message || 'trends failure');
    }
  }
}

function normalizeTopics(topics: string[]): string[] {
  const cleaned = topics.map(topic => topic.trim()).filter(Boolean).slice(0, 3);
  return cleaned.length > 0 ? cleaned : DEFAULT_BRIEFING_TOPICS;
}

async function trendsFallbackSection(ctx: ToolContext, topics: string[]): Promise<BriefingSectionResult<TrendsSection>> {
  const results = await Promise.allSettled(
    topics.map((topic) => withTimeout(
      webGroundedSearchTool.call({ query: `O que está em alta agora no X/Twitter e redes sociais sobre ${topic}` }, ctx),
      SECTION_TIMEOUT_MS,
      `trends-fallback:${topic}`,
    )),
  );
  const trends = results.flatMap((settled, idx) => {
    if (settled.status !== 'fulfilled' || !(settled.value as any).ok) return [];
    const answer = String((settled.value as any).receipt?.answer || '').trim();
    if (!answer) return [];
    return [{
      topic: topics[idx],
      summary: answer.slice(0, 220),
      signals: [],
    }];
  });
  return trends.length > 0 ? ok({ trends }) : fail('Sem trends agora');
}

function hostname(url: any): string | null {
  if (typeof url !== 'string' || !url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

export async function composeBriefing(
  ctx: ToolContext,
  options: { slot: 'morning' | 'evening'; news_topics: string[]; city: string | null | undefined },
): Promise<BriefingSections> {
  const [weather, calendar, goal, news, trends] = await Promise.all([
    weatherSection(ctx, options.city),
    calendarSection(ctx, options.slot),
    goalSection(ctx),
    newsSection(ctx, options.news_topics),
    trendsSection(ctx, options.news_topics),
  ]);
  return { weather, calendar, goal, news, trends };
}
