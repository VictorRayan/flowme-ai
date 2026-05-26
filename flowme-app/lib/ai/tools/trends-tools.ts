import { z } from 'zod';
import { defineTool } from './Tool';
import { webGroundedSearchTool } from './web-tools';

type TrendSignal = { quote: string };
type TrendItem = { topic: string; summary: string; signals: TrendSignal[] };
type TrendsResponse = { trends: TrendItem[] };

const HANDLE_REGEX = /@[A-Za-z0-9_]{2,30}/g;
const TCO_REGEX = /https?:\/\/t\.co\/\S+/gi;
const X_URL_REGEX = /https?:\/\/(?:www\.)?(?:x|twitter)\.com\/\S+/gi;

function sanitize(text: string): string {
  return String(text || '')
    .replace(HANDLE_REGEX, '')
    .replace(TCO_REGEX, '')
    .replace(X_URL_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280);
}

function sanitizeTrend(raw: any): TrendItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const topic = sanitize(raw.topic || raw.name || '');
  const summary = sanitize(raw.summary || raw.description || '');
  if (!topic || !summary) return null;
  const signalsSrc = Array.isArray(raw.signals) ? raw.signals : Array.isArray(raw.quotes) ? raw.quotes : [];
  const signals: TrendSignal[] = signalsSrc
    .slice(0, 3)
    .map((s: any) => ({ quote: sanitize(typeof s === 'string' ? s : (s?.quote || s?.text || '')) }))
    .filter((s: TrendSignal) => s.quote.length > 0);
  return { topic, summary, signals };
}

export const trendsFromTopicsTool = defineTool({
  name: 'trends.from_topics',
  description: `Returns the current online buzz for up to 3 topics — summaries plus illustrative paraphrased quotes that reflect what people are saying right now.

WHEN TO USE: morning/evening briefings, "what's people saying about X", "is X trending".

CONTRACT:
- topics: 1-3 short user-friendly phrases (e.g. ["IA generativa", "mercado de startups"]).
- Output is sanitized — never includes @handles or URLs to social platforms.
- Speak about the data as "current online conversation" or "what people are talking about right now". Never reveal the underlying source platform.

RETURNS receipt: { trends: [{topic, summary, signals: [{quote}]}] }.`,
  isReadOnly: true,
  inputSchema: z.object({
    topics: z.array(z.string().min(1).max(80)).min(1).max(3).describe('User-friendly topic strings. Max 3.'),
  }),
  call: async (args, ctx) => {
    try {
      const results = await Promise.allSettled(
        args.topics.map((topic) => webGroundedSearchTool.call({
          query: `O que as pessoas estão comentando agora sobre ${topic}? Resuma tendências recentes, debates e sinais atuais em português.`,
        }, ctx)),
      );
      const trends = results
        .map((settled, idx) => {
          if (settled.status !== 'fulfilled' || !settled.value.ok) return null;
          const answer = String((settled.value as any).receipt?.answer || '').trim();
          if (!answer) return null;
          return sanitizeTrend({
            topic: args.topics[idx],
            summary: answer,
            signals: [],
          });
        })
        .filter((t: TrendItem | null): t is TrendItem => t !== null)
        .slice(0, 9);
      if (trends.length === 0) return { ok: false, error: 'Trends unavailable: grounded search returned no trends.' };

      const receipt: TrendsResponse = { trends };
      return { ok: true, receipt };
    } catch (err: any) {
      const message = err?.message || 'trends unavailable';
      return { ok: false, error: `Trends fetch failed: ${message}` };
    }
  },
});
