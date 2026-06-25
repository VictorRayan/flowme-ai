import OpenAI from 'openai';

type Provider = 'openai' | 'gemini';

type SatisfactionInput = {
  userGoal: string;
  draftAnswer: string;
  uiLanguage?: string;
  connectorIntent?: string | null;
  toolsUsed?: string[];
};

const SYSTEM_PROMPT = `You are Balys Answer Satisfaction Agent.

Your job is to review the assistant's final draft BEFORE the user sees it.
Return the best final user-facing answer only.

Rules:
- Preserve factual content and tool results. Never invent data, actions, files, emails, payments, or calendar events.
- If the draft already satisfies the user's goal, keep it concise and polished.
- If the draft is shallow, unclear, in the wrong language, or fails the user's goal, rewrite it.
- If required context is missing, ask one clear follow-up question instead of pretending.
- Follow the configured UI language unless the latest user message explicitly requested another language.
- Use clean readable formatting. Do not expose raw markdown artifacts like dangling **, XML tags, JSON blobs, or internal tool names.
- Do not mention that you are a verifier or quality agent.`;

function target(): { provider: Provider; model: string; client: OpenAI } | null {
  if (process.env.GEMINI_API_KEY) {
    return {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      client: new OpenAI({
        apiKey: process.env.GEMINI_API_KEY,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        timeout: 12_000,
      }),
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      model: 'gpt-4o-mini',
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 12_000 }),
    };
  }
  return null;
}

function stripFence(value: string): string {
  const text = value.trim();
  const fenced = text.match(/^```(?:text|markdown|md)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] || text).trim();
}

function hasWriteTool(tools: string[] = []): boolean {
  return tools.some((tool) => /(create|update|delete|move|append|insert|write|draft|send|modify|reschedule|cancel|disconnect|connect)/i.test(tool));
}

export function shouldRunAnswerSatisfaction(input: SatisfactionInput): boolean {
  if (String(process.env.BALYS_ANSWER_SATISFACTION || '').toLowerCase() === 'off') return false;

  const answer = input.draftAnswer.trim();
  if (!answer) return false;
  if (/^(done|feito|pronto|ok|conclu[ií]do)[.!]?\s*$/i.test(answer)) return false;
  if (/^(tive um problema|não foi possível|could not|i could not|i had a problem)/i.test(answer)) return false;
  if (hasWriteTool(input.toolsUsed)) return false;

  const toolCount = input.toolsUsed?.length || 0;
  if (input.connectorIntent && input.connectorIntent !== 'image') return true;
  if (toolCount > 0) return true;
  if (answer.length > 280) return true;
  if (/(\*\*[^*]+\*\*|<\/?[a-z][\s\S]*>|```|\|.+\|)/i.test(answer)) return true;
  if (/\b(why|how|analyze|prioritize|strategy|explain|por que|como|analise|priorize|estrat[eé]gia|explique)\b/i.test(input.userGoal)) return true;

  return false;
}

export async function improveBalysAnswerIfNeeded(input: SatisfactionInput): Promise<string> {
  const original = input.draftAnswer.trim();
  if (!original) return original;
  if (!shouldRunAnswerSatisfaction({ ...input, draftAnswer: original })) return original;

  const selected = target();
  if (!selected) return original;

  try {
    const completion = await selected.client.chat.completions.create({
      model: selected.model,
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            `Configured UI language: ${input.uiLanguage || 'unknown'}`,
            `Detected intent: ${input.connectorIntent || 'none'}`,
            `Tools used: ${(input.toolsUsed || []).join(', ') || 'none'}`,
            '',
            `Latest user goal/message:`,
            input.userGoal || '(not provided)',
            '',
            `Draft answer to validate:`,
            original,
          ].join('\n'),
        },
      ],
    });
    const improved = stripFence(completion.choices?.[0]?.message?.content || '');
    if (!improved) return original;
    // Keep pathological rewrites from replacing a useful answer with a runaway essay.
    if (improved.length > Math.max(6000, original.length * 3.5)) return original;
    return improved;
  } catch (error) {
    console.warn('[balys-quality] answer satisfaction pass skipped:', error instanceof Error ? error.message : error);
    return original;
  }
}
