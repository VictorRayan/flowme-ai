import { weatherGetTool } from '@/lib/ai/tools/weather-tools';
import { calendarListEventsTool } from '@/lib/ai/tools/calendar-tools';
import { summarizeTitle } from '@/lib/goals/planner';
import { webGroundedSearchTool } from '@/lib/ai/tools/web-tools';
import { trendsFromTopicsTool } from '@/lib/ai/tools/trends-tools';
import type { ToolContext } from '@/lib/ai/tools/Tool';
import { weatherAdvice } from './weather-advice';
import type {
  BriefingSectionResult,
  BriefingSections,
  BriefingSlot,
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

async function weatherSection(ctx: ToolContext, city: string | null | undefined, slot: BriefingSlot): Promise<BriefingSectionResult<WeatherSection>> {
  if (!city) return fail('Sem cidade configurada');
  try {
    const result: any = await withTimeout(weatherGetTool.call({ city }, ctx), SECTION_TIMEOUT_MS, 'weather');
    if (!result.ok) return fail(result.error || 'Sem dados de clima');
    const r = result.receipt || result.data || {};
    const temperature = Number(r.temperature_c ?? r.current?.temperature_c ?? 0);
    const feelsLike = Number(r.feels_like_c ?? r.current?.feels_like_c ?? temperature);
    const precipitation = Number(r.precipitation_mm ?? r.current?.precipitation_mm ?? 0);
    const weatherCode = Number(r.weather_code ?? r.current?.weather_code ?? 0);
    const condition = String(r.condition || r.current?.condition || r.current?.description || '');
    return ok({
      temperature_c: temperature,
      feels_like_c: feelsLike,
      precipitation_mm: precipitation,
      weather_code: weatherCode,
      is_day: Boolean(r.is_day ?? r.current?.is_day ?? slot === 'morning'),
      condition,
      city: String(r.city || city),
      advice: weatherAdvice({
        slot,
        temperature_c: temperature,
        feels_like_c: feelsLike,
        precipitation_mm: precipitation,
        weather_code: weatherCode,
        condition,
      }),
    });
  } catch (err: any) {
    return fail(err?.message || 'weather failure');
  }
}

async function calendarSection(ctx: ToolContext, slot: BriefingSlot): Promise<BriefingSectionResult<CalendarSection>> {
  try {
    const now = new Date();
    const end = new Date(now);
    if (slot === 'evening') {
      // Evening looks ahead to tomorrow; morning/afternoon stay within today.
      end.setDate(end.getDate() + 1);
      end.setHours(23, 59, 59, 999);
    } else {
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

function clampSentence(text: string, max: number): string {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (lastStop > max * 0.5) return cut.slice(0, lastStop + 1).trim();
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function titleCase(topic: string): string {
  const t = topic.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function newsQuery(topic: string): string {
  return `Liste as 3 notícias mais recentes e relevantes sobre "${topic}". Para cada uma, dê um headline curto e factual e um subheadline de no máximo uma frase resumindo o fato principal. Responda APENAS com JSON válido, sem markdown, no formato: {"items":[{"headline":"...","subheadline":"..."}]}`;
}

function parseNewsItems(answer: string): Array<{ headline: string; subheadline: string }> {
  if (!answer) return [];
  let parsed: any = null;
  try {
    parsed = JSON.parse(answer);
  } catch {
    const match = answer.match(/\{[\s\S]*\}/);
    if (match) { try { parsed = JSON.parse(match[0]); } catch { parsed = null; } }
  }
  const raw = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
  return raw
    .map((it: any) => ({
      headline: clampSentence(String(it?.headline || it?.title || ''), 120),
      subheadline: clampSentence(String(it?.subheadline || it?.summary || it?.description || ''), 200),
    }))
    .filter((it: { headline: string }) => it.headline.length > 0)
    .slice(0, 3);
}

async function newsSection(ctx: ToolContext, topics: string[]): Promise<BriefingSectionResult<NewsSection>> {
  const activeTopics = normalizeTopics(topics);
  try {
    const results = await Promise.allSettled(
      activeTopics.map((topic) => withTimeout(webGroundedSearchTool.call({ query: newsQuery(topic) }, ctx), SECTION_TIMEOUT_MS, `news:${topic}`)),
    );

    const by_topic = results.map((settled, idx) => {
      const topic = activeTopics[idx];
      if (settled.status !== 'fulfilled' || !(settled.value as any).ok) {
        return { topic, items: [] as NewsItem[] };
      }
      const value: any = settled.value;
      const answer = String(value.receipt?.answer || '');
      const citations: any[] = value.receipt?.citations || [];
      const parsed = parseNewsItems(answer);

      let items: NewsItem[];
      if (parsed.length > 0) {
        items = parsed.map((p, i) => {
          const citation = citations[i] || citations[0] || null;
          return {
            title: p.headline,
            summary: p.subheadline,
            url: citation?.url || null,
            source: citation ? (citation.title || hostname(citation.url)) : null,
          };
        });
      } else if (answer.trim()) {
        // Structured parse failed — emit ONE concise item, never the full repeated block.
        const citation = citations[0] || null;
        items = [{
          title: titleCase(topic),
          summary: clampSentence(answer, 200),
          url: citation?.url || null,
          source: citation ? (citation.title || hostname(citation.url)) : null,
        }];
      } else {
        items = [];
      }
      return { topic, items };
    });

    const anyHit = by_topic.some((t) => t.items.length > 0);
    if (!anyHit) return fail('Sem notícias agora');
    return ok({ by_topic });
  } catch (err: any) {
    return fail(err?.message || 'news failure');
  }
}

// "No ar agora" shows ONLY real X.com (Twitter) trends — headline + subheadline
// consolidated from the live conversation. No web/Gemini fallback: when X has
// nothing (or the API has no credit), the section stays empty instead of
// surfacing generic web summaries.
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
    return fail(result.error || 'Sem trends do X agora');
  } catch (err: any) {
    return fail(err?.message || 'trends failure');
  }
}

function normalizeTopics(topics: string[]): string[] {
  const cleaned = topics.map(topic => topic.trim()).filter(Boolean).slice(0, 3);
  return cleaned.length > 0 ? cleaned : DEFAULT_BRIEFING_TOPICS;
}

function hostname(url: any): string | null {
  if (typeof url !== 'string' || !url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

export async function composeBriefing(
  ctx: ToolContext,
  options: { slot: BriefingSlot; news_topics: string[]; city: string | null | undefined },
): Promise<BriefingSections> {
  const [weather, calendar, goal, news, trends] = await Promise.all([
    weatherSection(ctx, options.city, options.slot),
    calendarSection(ctx, options.slot),
    goalSection(ctx),
    newsSection(ctx, options.news_topics),
    trendsSection(ctx, options.news_topics),
  ]);
  return { weather, calendar, goal, news, trends };
}
