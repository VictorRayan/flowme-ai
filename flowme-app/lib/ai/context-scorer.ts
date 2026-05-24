import OpenAI from 'openai';

export interface ContextScores {
  ambiguity: number;      // 0–1
  reasoning: number;      // 0–1
  workflowLength: number; // 0–1
  risk: number;           // 0–1
  threadDepth: number;    // 0–1  — how deep / multi-turn the conversation is
  topicShift: number;     // 0–1  — has the topic meaningfully changed recently
  confidence: number;     // 0–1  — how confident the scorer is in its output
}

const SCORER_SYSTEM = `You are a routing judge for an AI assistant. Given a conversation thread, output a JSON object with complexity scores from 0.0 to 1.0.

Scores:
- ambiguity: how vague, relative, or unclear the latest request is (0=crystal clear, 1=very vague)
- reasoning: how much multi-step reasoning, analysis, or synthesis is required (0=simple, 1=deep)
- workflowLength: how many distinct actions or tool calls will be needed (0=zero/one, 1=many chained)
- risk: potential for irreversible or destructive actions (0=read-only, 1=delete/overwrite/send)
- threadDepth: how much prior conversation context matters to answer correctly (0=fresh, 1=deep thread)
- topicShift: has the topic changed significantly in the last 2 turns vs the rest (0=same topic, 1=pivot)
- confidence: how confident you are in these scores (0=guessing, 1=certain)

Rules:
- Output ONLY a raw JSON object, no markdown, no explanation.
- All values must be numbers between 0.0 and 1.0 with 2 decimal places.
- Base your judgment on the FULL thread, not just the last message.`;

function buildScorerPrompt(messages: Array<{ role: string; content: string }>): string {
  // Use last 12 messages for context, summarise older ones as a count
  const recent = messages.slice(-12);
  const older = messages.length - recent.length;
  const parts: string[] = [];
  if (older > 0) parts.push(`[... ${older} earlier messages ...]`);
  for (const m of recent) {
    const text = typeof m.content === 'string' ? m.content.slice(0, 400) : '[non-text]';
    parts.push(`${m.role.toUpperCase()}: ${text}`);
  }
  return parts.join('\n\n');
}

function parseScores(raw: string): ContextScores | null {
  try {
    const json = JSON.parse(raw.trim());
    const clamp = (v: unknown) => Math.max(0, Math.min(1, typeof v === 'number' ? v : 0.5));
    return {
      ambiguity:      clamp(json.ambiguity),
      reasoning:      clamp(json.reasoning),
      workflowLength: clamp(json.workflowLength),
      risk:           clamp(json.risk),
      threadDepth:    clamp(json.threadDepth),
      topicShift:     clamp(json.topicShift),
      confidence:     clamp(json.confidence),
    };
  } catch {
    return null;
  }
}

// Runs a cheap LLM call to score the thread context.
// Returns null if unavailable or too slow — caller must handle gracefully.
export async function scoreThreadContext(
  messages: Array<{ role: string; content: string }>,
  timeoutMs = 4000,
): Promise<ContextScores | null> {
  // Need at least 3 messages to be worth scoring (avoids overhead on fresh threads)
  const userMessages = messages.filter(m => m.role === 'user');
  if (userMessages.length < 2) return null;

  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const useGemini = Boolean(process.env.GEMINI_API_KEY);
  const client = new OpenAI({
    apiKey,
    baseURL: useGemini ? 'https://generativelanguage.googleapis.com/v1beta/openai/' : undefined,
  });
  const model = useGemini ? 'gemini-2.5-flash' : 'gpt-4o-mini';

  const prompt = buildScorerPrompt(messages);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await client.chat.completions.create(
      {
        model,
        temperature: 0,
        max_tokens: 120,
        messages: [
          { role: 'system', content: SCORER_SYSTEM },
          { role: 'user', content: prompt },
        ],
      },
      { signal: controller.signal as any },
    );
    const raw = response.choices[0]?.message?.content?.trim() || '';
    return parseScores(raw);
  } catch (e: any) {
    if (e?.name !== 'AbortError') {
      console.warn('[context-scorer] failed:', e?.message || e);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}
