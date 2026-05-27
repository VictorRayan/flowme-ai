import { z } from 'zod';
import { defineTool } from './Tool';

type TrendSignal = { quote: string; url?: string | null };
type TrendItem = {
  topic: string;
  headline: string;
  subheadline: string;
  url: string;
  summary: string;
  signals: TrendSignal[];
};
type TrendsResponse = { trends: TrendItem[] };

const HANDLE_REGEX = /@[A-Za-z0-9_]{2,30}/g;
const TCO_REGEX = /https?:\/\/t\.co\/\S+/gi;
const X_URL_REGEX = /^https:\/\/(?:www\.)?(?:x|twitter)\.com\/\S+/i;

function sanitize(text: string): string {
  return String(text || '')
    .replace(HANDLE_REGEX, '')
    .replace(TCO_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeXUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!X_URL_REGEX.test(trimmed)) return '';
  return trimmed.replace(/^https:\/\/twitter\.com\//i, 'https://x.com/').replace(/^https:\/\/www\.twitter\.com\//i, 'https://x.com/').replace(/^https:\/\/www\.x\.com\//i, 'https://x.com/');
}

function sanitizeTrend(raw: any, fallbackTopic = ''): TrendItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const topic = sanitize(raw.topic || raw.name || fallbackTopic);
  const headline = sanitize(raw.headline || raw.title || raw.topic || '');
  const subheadline = sanitize(raw.subheadline || raw.summary || raw.description || '');
  const url = normalizeXUrl(raw.url || raw.thread_url || raw.post_url || raw.x_url);
  if (!topic || !headline || !subheadline || !url) return null;
  const signalsSrc = Array.isArray(raw.signals) ? raw.signals : Array.isArray(raw.quotes) ? raw.quotes : [];
  const signals: TrendSignal[] = signalsSrc
    .slice(0, 3)
    .map((s: any) => ({
      quote: sanitize(typeof s === 'string' ? s : (s?.quote || s?.text || '')),
      url: normalizeXUrl(typeof s === 'string' ? raw.url : (s?.url || s?.post_url || s?.thread_url || raw.url)),
    }))
    .filter((s: TrendSignal) => s.quote.length > 0);
  return { topic, headline, subheadline, url, summary: subheadline, signals };
}

function extractResponseText(response: any): string {
  if (typeof response?.output_text === 'string') return response.output_text;
  const output = Array.isArray(response?.output) ? response.output : [];
  return output
    .flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    .map((content: any) => content?.text || '')
    .filter(Boolean)
    .join('\n');
}

function parseTrendsJson(text: string, topics: string[]): TrendItem[] {
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch { parsed = null; }
    }
  }
  const rawTrends = Array.isArray(parsed?.trends) ? parsed.trends : [];
  return rawTrends
    .map((trend: any, idx: number) => sanitizeTrend(trend, topics[idx] || topics[0] || 'X'))
    .filter((trend: TrendItem | null): trend is TrendItem => trend !== null)
    .slice(0, 6);
}

export const trendsFromTopicsTool = defineTool({
  name: 'trends.from_topics',
  description: `Returns current X.com conversation for up to 3 topics — headline, subheadline, and source links to read the thread on X.

WHEN TO USE: morning/evening briefings, "what's people saying about X", "is X trending".

CONTRACT:
- topics: 1-3 short user-friendly phrases (e.g. ["IA generativa", "mercado de startups"]).
- Only use X.com/X Search sources.
- Every item must include a real X.com URL where the user can read the post/thread.
- Do not return generic web summaries.

RETURNS receipt: { trends: [{topic, headline, subheadline, url, summary, signals: [{quote, url}]}] }.`,
  isReadOnly: true,
  inputSchema: z.object({
    topics: z.array(z.string().min(1).max(80)).min(1).max(3).describe('User-friendly topic strings. Max 3.'),
  }),
  call: async (args) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: 'Trends unavailable: XAI_API_KEY not configured.' };

    try {
      const response = await fetch('https://api.x.ai/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'grok-4.3',
          input: [{
            role: 'user',
            content: `Busque exclusivamente no X.com conversas atuais sobre: ${args.topics.join(' | ')}.

Retorne JSON estrito, sem markdown:
{
  "trends": [
    {
      "topic": "tema curto",
      "headline": "headline curta, especifica e humana",
      "subheadline": "1 frase com o contexto do que esta acontecendo no X, sem cortar palavras",
      "url": "https://x.com/.../status/...",
      "signals": [
        { "quote": "reacao ou leitura parafraseada", "url": "https://x.com/.../status/..." }
      ]
    }
  ]
}

Regras:
- Somente inclua itens com URL real do X.com.
- Prefira posts ou threads que abrem contexto de leitura.
- Nao invente URLs.
- Nao use fontes fora do X.com.
- Maximo 2 itens por topico.`,
          }],
          tools: [{ type: 'x_search' }],
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        return { ok: false, error: `X search failed: ${body?.error || body?.message || response.statusText}` };
      }

      const trends = parseTrendsJson(extractResponseText(body), args.topics);
      if (trends.length === 0) return { ok: false, error: 'X search returned no linkable trends.' };

      const receipt: TrendsResponse = { trends };
      return { ok: true, receipt };
    } catch (err: any) {
      const message = err?.message || 'trends unavailable';
      return { ok: false, error: `Trends fetch failed: ${message}` };
    }
  },
});
