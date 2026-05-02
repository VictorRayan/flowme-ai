import { z } from 'zod';
import { defineTool } from './Tool';
import OpenAI from 'openai';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const EMBEDDING_MODEL = 'text-embedding-3-small';
const SIMILARITY_FLOOR = 0.25;

function extractEmailsFromText(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(EMAIL_REGEX) || [];
  return Array.from(new Set(matches));
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function tokenScore(haystack: string, tokens: string[]): number {
  if (!haystack) return 0;
  const lower = haystack.toLowerCase();
  return tokens.reduce((s, t) => s + (lower.includes(t.toLowerCase()) ? 1 : 0), 0);
}

let cachedOpenAI: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (cachedOpenAI) return cachedOpenAI;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  cachedOpenAI = new OpenAI({ apiKey });
  return cachedOpenAI;
}

async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  const openai = getOpenAI();
  if (!openai) return texts.map(() => null);
  const inputs = texts.map((t) => (t || '').slice(0, 8000)).map((t) => (t.trim() ? t : null));
  const nonNullIdx: number[] = [];
  const nonNullInputs: string[] = [];
  inputs.forEach((t, i) => { if (t) { nonNullIdx.push(i); nonNullInputs.push(t); } });
  if (nonNullInputs.length === 0) return texts.map(() => null);
  try {
    const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: nonNullInputs });
    const out: (number[] | null)[] = texts.map(() => null);
    res.data.forEach((d, i) => { out[nonNullIdx[i]] = d.embedding; });
    return out;
  } catch (e) {
    console.error('[people.search] embedding batch failed', e);
    return texts.map(() => null);
  }
}

export const peopleSearchTool = defineTool({
  name: 'people.search',
  description: `Searches the user's saved contacts using semantic similarity (cosine on embeddings). Read-only.

WHEN TO USE: any time the user mentions a person — by first name, full name, nickname, role ("minha esposa", "o advogado"), or context ("o cara da Zé Delivery") — and you need their email or background. Especially before:
- adding them as a calendar event participant ("invite Anna" → people.search query="Anna")
- drafting an email to them ("email Bob" → people.search query="Bob")
- referring to them in a note where their identity matters

CONTRACT:
- query is REQUIRED. Pass the user's exact phrasing — semantic search handles transcription errors, nicknames, role descriptions, and partial names.
- Searches BOTH the structured people table AND notes of type 'person' (Profile notes), unified by name.
- Read-only.

RETURNS receipt: { matches[], count }. Each match: { name, email, all_emails, has_email, bio, similarity, source }.
- similarity is the cosine similarity between the query and the contact's embedding (0-1). Above 0.5 is a strong match. Below 0.3 is weak.
- email is the primary email; all_emails is the dedup'd full list.
- has_email = email !== null. If false, ASK the user.
- bio is a snippet from the profile note (do not read aloud verbatim).
- source: 'people' / 'profile_note' / 'merged'.

If count is 0 or the top similarity is below 0.3, treat as not found and ask the user. Do not pick a low-confidence match silently.

If multiple matches with similar scores (within 0.05), ask the user which one ("encontrei Anna Costa e Anna Silva — qual?").

NEVER fabricate emails. If a person isn't found and the user didn't supply an email, ASK before proceeding.`,
  isReadOnly: true,
  inputSchema: z.object({
    query: z.string().describe('Name, partial name, nickname, role, or descriptive reference. Semantic search handles fuzziness.'),
    limit: z.number().optional().default(5).describe('Max contacts to return. Default 5.'),
  }),
  call: async (args, context) => {
    try {
      const limit = Math.max(1, Math.min(20, args.limit || 5));
      const query = args.query.trim();
      if (!query) return { ok: false, error: 'query is required' };

      const tokens = Array.from(new Set(
        query.split(/\s+/).map((t) => t.replace(/[^\p{L}\p{N}]/gu, '')).filter((t) => t.length >= 2)
      ));

      const [peopleRes, notesRes] = await Promise.all([
        context.supabase
          .from('people')
          .select('id, name, email, person_note_id')
          .eq('user_id', context.user.id),
        context.supabase
          .from('notes')
          .select('id, title, content_text, embedding')
          .eq('user_id', context.user.id)
          .eq('note_type', 'person')
          .eq('is_deleted', false),
      ]);

      if (peopleRes.error) throw peopleRes.error;
      if (notesRes.error) throw notesRes.error;

      const noteById = new Map<string, { id: string; title: string; content_text: string; embedding: number[] | null }>();
      for (const n of notesRes.data || []) {
        noteById.set(n.id, {
          id: n.id,
          title: n.title || '',
          content_text: n.content_text || '',
          embedding: Array.isArray(n.embedding) ? n.embedding : null,
        });
      }

      type Candidate = {
        name: string;
        email: string | null;
        all_emails: string[];
        bio: string | null;
        source: 'people' | 'profile_note' | 'merged';
        text: string;
        embedding: number[] | null;
        noteIdToBackfill?: string;
      };

      const byName = new Map<string, Candidate>();

      for (const p of peopleRes.data || []) {
        const linkedNote = p.person_note_id ? noteById.get(p.person_note_id) : null;
        const noteEmails = linkedNote ? extractEmailsFromText(linkedNote.content_text) : [];
        const allEmails = Array.from(new Set([p.email, ...noteEmails].filter(Boolean) as string[]));
        const primaryEmail = p.email || allEmails[0] || null;
        const bio = linkedNote ? linkedNote.content_text.slice(0, 200) : null;
        const text = [
          p.name,
          primaryEmail || '',
          linkedNote ? linkedNote.content_text : '',
        ].filter(Boolean).join('\n').slice(0, 8000);
        byName.set(p.name.toLowerCase().trim(), {
          name: p.name,
          email: primaryEmail,
          all_emails: allEmails,
          bio,
          source: linkedNote ? 'merged' : 'people',
          text,
          embedding: linkedNote?.embedding || null,
          noteIdToBackfill: linkedNote && !linkedNote.embedding ? linkedNote.id : undefined,
        });
        if (p.person_note_id) noteById.delete(p.person_note_id);
      }

      for (const n of noteById.values()) {
        const name = (n.title || '').trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (byName.has(key)) continue;
        const emails = extractEmailsFromText(n.content_text);
        const text = [name, n.content_text || ''].filter(Boolean).join('\n').slice(0, 8000);
        byName.set(key, {
          name,
          email: emails[0] || null,
          all_emails: emails,
          bio: n.content_text.slice(0, 200),
          source: 'profile_note',
          text,
          embedding: n.embedding,
          noteIdToBackfill: !n.embedding ? n.id : undefined,
        });
      }

      const candidates = Array.from(byName.values());

      if (candidates.length === 0) {
        return { ok: true, receipt: { matches: [], count: 0 } };
      }

      const queryEmbeddingArr = await embedTexts([query]);
      const queryEmbedding = queryEmbeddingArr[0];

      let scored: Array<Candidate & { similarity: number }>;

      if (queryEmbedding) {
        const needEmbedIdx: number[] = [];
        candidates.forEach((c, i) => { if (!c.embedding) needEmbedIdx.push(i); });

        if (needEmbedIdx.length > 0) {
          const computed = await embedTexts(needEmbedIdx.map((i) => candidates[i].text));
          for (let k = 0; k < needEmbedIdx.length; k++) {
            const i = needEmbedIdx[k];
            const emb = computed[k];
            if (emb) {
              candidates[i].embedding = emb;
              if (candidates[i].noteIdToBackfill) {
                context.supabase
                  .from('notes')
                  .update({ embedding: emb, embedding_updated_at: new Date().toISOString() })
                  .eq('id', candidates[i].noteIdToBackfill!)
                  .eq('user_id', context.user.id)
                  .then(() => {}, (err: unknown) => console.error('[people.search] backfill embed failed', err));
              }
            }
          }
        }

        scored = candidates.map((c) => ({
          ...c,
          similarity: c.embedding ? cosineSimilarity(queryEmbedding, c.embedding) : 0,
        }));
      } else {
        scored = candidates.map((c) => ({
          ...c,
          similarity: tokenScore(c.text, tokens) / Math.max(1, tokens.length),
        }));
      }

      scored.sort((a, b) => b.similarity - a.similarity);

      const filtered = scored.filter((c) => c.similarity >= SIMILARITY_FLOOR);
      const top = (filtered.length > 0 ? filtered : scored.slice(0, 1)).slice(0, limit);

      return {
        ok: true,
        receipt: {
          matches: top.map((c) => ({
            name: c.name,
            email: c.email,
            all_emails: c.all_emails,
            has_email: Boolean(c.email),
            bio: c.bio,
            similarity: Math.round(c.similarity * 100) / 100,
            source: c.source,
          })),
          count: top.length,
        },
      };
    } catch (e: any) {
      return { ok: false, error: e.message || 'Failed to search contacts' };
    }
  },
});
