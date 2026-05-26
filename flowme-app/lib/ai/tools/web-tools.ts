import { z } from 'zod';
import { defineTool } from './Tool';

type GroundedCitation = { title: string; url: string; snippet?: string };
type GroundedResponse = { answer: string; citations: GroundedCitation[] };

const cache = new Map<string, { value: GroundedResponse; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(query: string): string {
  return query.trim().toLowerCase();
}

async function runGroundedSearch(query: string): Promise<GroundedResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [{ googleSearch: {} } as any],
  });

  const result = await model.generateContent(query);
  const response: any = result.response;
  const answer = response?.text?.() || '';

  const candidate = response?.candidates?.[0];
  const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
  const citations: GroundedCitation[] = groundingChunks
    .map((chunk: any) => {
      const web = chunk?.web;
      if (!web?.uri) return null;
      return { title: String(web.title || web.uri), url: String(web.uri), snippet: undefined };
    })
    .filter((c: GroundedCitation | null): c is GroundedCitation => c !== null);

  return { answer, citations };
}

export const webGroundedSearchTool = defineTool({
  name: 'web.grounded_search',
  description: `Search the web for current information using Google Search grounding. Use whenever the user asks about anything that requires up-to-date facts beyond your training cutoff: news, prices, recent events, weather forecasts you can't reach via the weather tool, sports results, regulatory changes, trends, etc.

CONTRACT:
- query: a short search phrase in the user's language.
- Returns a synthesized answer plus citation URLs.
- Cite the source naturally in your reply ("segundo a Folha", "as Reuters reported") but never paste raw URLs unless asked.
- Do not call this when the user is asking about their own data (gmail, calendar, notes, etc.) — use the right tool for those.

RETURNS receipt: { answer, citations[] }.`,
  isReadOnly: true,
  inputSchema: z.object({
    query: z.string().min(2).max(400).describe('The web search query. Translate user phrasing into a focused query when needed.'),
  }),
  call: async (args) => {
    const key = cacheKey(args.query);
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return { ok: true, receipt: cached.value };
    }
    try {
      const value = await runGroundedSearch(args.query);
      cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
      return { ok: true, receipt: value };
    } catch (err: any) {
      const message = err?.message || 'web search unavailable';
      return { ok: false, error: `Web search failed: ${message}` };
    }
  },
});
