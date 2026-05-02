export interface ThreadMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ThreadSummary {
  thread_id: string;
  summary: string;
  key_topics: string[];
  turn_count: number;
  summarized_at: string;
}

export interface ThreadRecallMatch {
  thread_id: string;
  summary: string;
  key_topics: string[];
  similarity: number;
  summarized_at: string;
}

export const SUMMARIZE_EVERY_N_USER_TURNS = 8;
export const RECALL_DEFAULT_K = 4;
export const RECALL_SIMILARITY_THRESHOLD = 0.55;

const SUMMARIZER_SYSTEM_PROMPT = `You compress chat conversations between a user and an AI assistant called Balys into a compact, dense summary used by the assistant's long-term memory.

Output strictly as JSON with this shape:
{
  "summary": "<3-6 sentence dense paragraph capturing what was discussed, decided, and learned about the user. Third person about the user.>",
  "key_topics": ["topic1", "topic2", ...]
}

Rules:
- summary: 3-6 sentences, ~80-160 words. Capture decisions, preferences, ongoing work, important people mentioned, key questions asked.
- key_topics: 3-7 short tags (1-3 words each, lowercase, no punctuation). Topics should be searchable: "career change", "wife birthday", "tax filing", "react bug", "pricing strategy".
- Do NOT invent. If the conversation was trivial small talk, say so plainly: summary="Brief small talk about <X>." key_topics=["small talk"].
- Do NOT include the date — that's stored separately.
- No markdown, no preamble. JSON only.`;

interface SummarizeResult {
  ok: boolean;
  summary?: string;
  key_topics?: string[];
  reason?: string;
}

export async function summarizeThread(messages: ThreadMessage[]): Promise<SummarizeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, reason: 'OPENAI_API_KEY missing' };

  const transcript = messages
    .filter((m) => m.role !== 'system' && m.content)
    .slice(-40)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n')
    .slice(0, 24000);

  if (!transcript.trim()) return { ok: false, reason: 'empty transcript' };

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SUMMARIZER_SYSTEM_PROMPT },
          { role: 'user', content: transcript },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, reason: `summarizer HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return { ok: false, reason: 'empty response' };
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { return { ok: false, reason: 'invalid JSON' }; }
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    const topics = Array.isArray(parsed.key_topics)
      ? parsed.key_topics.filter((t: unknown) => typeof t === 'string').map((t: string) => t.trim().toLowerCase()).slice(0, 8)
      : [];
    if (!summary) return { ok: false, reason: 'summary missing' };
    return { ok: true, summary, key_topics: topics };
  } catch (e: any) {
    return { ok: false, reason: e?.message || String(e) };
  }
}

export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!text || !text.trim()) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000),
      }),
    });
    if (!res.ok) {
      console.error('[memory.recall] embedText HTTP', res.status);
      return null;
    }
    const data = await res.json();
    const vec = data?.data?.[0]?.embedding;
    return Array.isArray(vec) ? vec : null;
  } catch (e) {
    console.error('[memory.recall] embedText threw:', e);
    return null;
  }
}

export async function upsertThreadSummary(
  supabase: any,
  userId: string,
  threadId: string,
  summary: string,
  keyTopics: string[],
  embedding: number[] | null,
  turnCount: number,
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('thread_summaries')
      .select('id, summary_version')
      .eq('user_id', userId)
      .eq('thread_id', threadId)
      .maybeSingle();

    const nextVersion = (existing?.summary_version || 0) + 1;
    const { error } = await supabase
      .from('thread_summaries')
      .upsert({
        user_id: userId,
        thread_id: threadId,
        summary,
        key_topics: keyTopics,
        embedding,
        turn_count: turnCount,
        summary_version: nextVersion,
        summarized_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,thread_id' });
    if (error) console.error('[memory.recall] upsert error:', error);
  } catch (e) {
    console.error('[memory.recall] upsert threw:', e);
  }
}

/**
 * Cosine search on thread_summaries. Filters by similarity threshold.
 * Excludes the current thread (the user is in it; they don't want to recall themselves).
 */
export async function recallSimilarThreads(
  supabase: any,
  userId: string,
  query: string,
  options?: { k?: number; threshold?: number; excludeThreadId?: string },
): Promise<ThreadRecallMatch[]> {
  const k = options?.k ?? RECALL_DEFAULT_K;
  const threshold = options?.threshold ?? RECALL_SIMILARITY_THRESHOLD;
  const excludeThreadId = options?.excludeThreadId;

  const queryEmbedding = await embedText(query);
  if (!queryEmbedding) return [];

  try {
    // Pull all candidate summaries for the user, score in memory.
    // For now we don't have a Supabase RPC; we limit by recency and rank client-side.
    const { data, error } = await supabase
      .from('thread_summaries')
      .select('thread_id, summary, key_topics, embedding, summarized_at')
      .eq('user_id', userId)
      .not('embedding', 'is', null)
      .order('summarized_at', { ascending: false })
      .limit(120);
    if (error) {
      console.error('[memory.recall] recallSimilarThreads select error:', error);
      return [];
    }
    if (!Array.isArray(data) || data.length === 0) return [];

    const scored = data
      .filter((r: any) => !excludeThreadId || r.thread_id !== excludeThreadId)
      .map((r: any) => ({
        thread_id: r.thread_id as string,
        summary: r.summary as string,
        key_topics: (r.key_topics as string[]) || [],
        similarity: cosineSimilarity(queryEmbedding, r.embedding as number[]),
        summarized_at: r.summarized_at as string,
      }))
      .filter((m) => m.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);

    return scored;
  } catch (e) {
    console.error('[memory.recall] recallSimilarThreads threw:', e);
    return [];
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/** Best-effort: summarize + embed + upsert. Logs but never throws. */
export async function summarizeAndPersistThread(
  supabase: any,
  userId: string,
  threadId: string,
  messages: ThreadMessage[],
): Promise<void> {
  if (!messages || messages.length < 4) return;
  const result = await summarizeThread(messages);
  if (!result.ok || !result.summary) {
    console.log('[memory.recall] summarize skipped:', result.reason);
    return;
  }
  const embedInput = `${result.summary}\n\nTopics: ${(result.key_topics || []).join(', ')}`;
  const embedding = await embedText(embedInput);
  await upsertThreadSummary(
    supabase,
    userId,
    threadId,
    result.summary,
    result.key_topics || [],
    embedding,
    messages.length,
  );
}
