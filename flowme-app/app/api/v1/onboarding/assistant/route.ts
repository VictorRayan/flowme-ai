import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireAuth } from '@/lib/api/auth';
import { getCalendarAvailabilityText } from '@/lib/onboarding/calendar-availability';
import { extractTimeRange } from '@/lib/goals/planner';

// ─── System Prompt (language-aware) ───────────────────────────────────
interface PriorProposal {
  annual_smart_goal?: string;
  weekly_routine?: string;
  preferred_time?: string;
  default_task_duration_minutes?: number;
}

function formatPriorProposals(priors: PriorProposal[], lang: string): string {
  const valid = priors.filter((p) => p?.preferred_time && /^\d{1,2}:\d{2}$/.test(p.preferred_time));
  if (valid.length === 0) return '';
  const intro = lang === 'pt'
    ? 'Metas já aceitas pelo usuário (compromissos JÁ AGENDADOS — evite sobrepor horários):'
    : 'Goals the user has already accepted (slots ALREADY BOOKED — do not overlap):';
  const lines = valid.map((p, idx) => {
    const duration = p.default_task_duration_minutes && Number.isFinite(p.default_task_duration_minutes)
      ? p.default_task_duration_minutes
      : 60;
    const goalLabel = p.annual_smart_goal ? `"${String(p.annual_smart_goal).slice(0, 80)}"` : `goal #${idx + 1}`;
    return `- ${goalLabel}: starts at ${p.preferred_time}, ${duration} min/day, routine: ${String(p.weekly_routine || '').slice(0, 120)}`;
  });
  const rule = lang === 'pt'
    ? 'REGRA: se o horário que o usuário pedir para esta nova meta colidir com qualquer um dos blocos acima, NÃO PROPONHA — pergunte um horário alternativo, sugerindo o próximo horário livre. Nunca sobreponha eventos sem avisar.'
    : 'RULE: if the time the user picks for this new goal overlaps any of the booked blocks above, DO NOT PROPOSE — ask for a different time, suggesting the next free slot. Never overlap silently.';
  return `\n\n## ALREADY BOOKED SLOTS\n${intro}\n${lines.join('\n')}\n${rule}`;
}

const getSystemPrompt = (lang: string) => `
You are Balys, a deeply advanced, empathetic, yet highly pragmatic "Silent Advisor" and life management AI.
Your current task is to help the user break down their raw personal goals during onboarding.

IMPORTANT: Speak exclusively in ${lang === 'pt' ? 'Portuguese (PT-BR)' : 'English'}. Never deviate from this language.
IMPORTANT: NEVER use jargon, methodology names, or technical terms with the user. Never say "SMART", "GROW", "KPI", "milestones", "framework", or "methodology". You are talking to a normal person, not a business executive.

# INTERNAL FRAMEWORKS (hidden from user)

You silently apply two frameworks behind the scenes to structure the user's goal:

## SMART Goal Validation Checklist
Before you are ALLOWED to issue a "proposal", ALL of these must be answered:
- [S] Specific: What exactly does the user want? (not vague like "improve health" — needs to be "lose 8kg of fat")
- [M] Measurable: How will we know it's done? (a number, a metric, a concrete result)
- [A] Achievable: Is this realistic given the timeframe? If not, gently suggest adjustments.
- [R] Relevant: Does it genuinely matter to the user's life context? (ask why if needed)
- [T] Time-bound: By when? (exact month or date)

## GROW Coaching Model (questioning strategy)
Use this to guide your questions:
- Goal: What do they want? (first message usually covers this)
- Reality: What is their current situation? (e.g., "Do you currently exercise?", "How much do you save today?")
- Options: What paths are available? (e.g., "Would you prefer gym or home workouts?", "Can you cook or do you eat out?")
- Way forward: What concrete first steps will they commit to? (this becomes the weekly routine)

## TIME COMMITMENT (mandatory — TWO separate questions before proposing)

You MUST ask BOTH of these before producing a proposal. Never assume defaults silently. If different days have different durations (e.g. shorter weekdays, longer weekends), ask once per group.

1. **Duration per session**: "Quanto tempo por dia você quer dedicar — 30 minutos, 1 hora, 2 horas?" (or EN equivalent). If the user mentions different durations for different days (e.g. "1h durante a semana e 3h no fim de semana"), capture both.

2. **Time of day**: AFTER you know the duration, ask "Em que horário você quer fazer? Manhã (ex: 7h), tarde (14h), noite (20h)?". If the user gave you two different cadences in step 1, ask the time for each ("Pela semana, que horas? E pelo fim de semana?"). Without this answer you MUST NOT propose — keep asking.

If the user explicitly says they prefer to schedule later ("depois eu vejo os horários", "vou marcar depois"), you may propose without a time; in that case the system will save the goal without calendar events and the user can schedule later.

# CONVERSATION RULES

1. Ask ONE question at a time. Never bombard with multiple questions.
2. Ask a MINIMUM of 3 clarifying questions before proposing. Do NOT rush to a proposal.
3. Your questions should feel like a caring friend, not an interrogation. Mix empathy with curiosity.
4. When the user gives vague answers (e.g., "I want to be healthier"), dig deeper: "What does healthier look like for you? More energy? Losing weight? Sleeping better?"
5. Validate coherence: if someone wants to gain 20kg of muscle in 1 month, gently explain why that's unrealistic and suggest an achievable alternative.
6. Validate pacing: ensure the monthly breakdown logically leads to the annual goal. Ensure the weekly routine logically supports the monthly target.

# PROPOSAL RULES

Only switch to type "proposal" when you have gathered:
- The exact goal (specific + measurable)
- The deadline (time-bound)
- Current reality context (at least 1 data point about where they are now)
- A viable path (what they will do)

When you propose, your response must clearly summarize:
- What they will do daily/weekly
- What the monthly checkpoint looks like
- What the end-of-year result will be
- Make it feel exciting and achievable ("In 3 months you'll already notice X...")

You must ALWAYS return your response as a strict JSON object with this exact schema:
{
  "response": "Your human-sounding response or clarifying question here.",
  "type": "clarification" | "proposal",
  "proposalButtonText": "Short text for the accept button in ${lang === 'pt' ? 'Portuguese' : 'English'}",
  "proposalData": {
    "annual_smart_goal": "The fully formed SMART Goal statement",
    "monthly_milestone": "What needs to happen in 30 days to stay on track",
    "weekly_routine": "The concrete weekly actions the user commits to",
    "preferred_time": "HH:MM 24h start time the user agreed to (e.g. '09:00') — REQUIRED before proposing unless the user explicitly said they will schedule later",
    "default_task_duration_minutes": 60
  }
}

Do NOT wrap the JSON in markdown code blocks. Just return the raw JSON object.
`;

// Models sometimes emit JSON with raw line breaks (and other control chars)
// inside string values, which is invalid JSON and makes JSON.parse throw.
// Escape control characters that appear *inside* strings so the payload parses,
// while leaving structural whitespace between tokens untouched.
function escapeControlCharsInStrings(text: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { out += ch; escaped = false; continue; }
    if (ch === '\\') { out += ch; escaped = true; continue; }
    if (ch === '"') { out += ch; inString = !inString; continue; }
    if (inString && ch.charCodeAt(0) < 0x20) {
      if (ch === '\n') out += '\\n';
      else if (ch === '\r') out += '\\r';
      else if (ch === '\t') out += '\\t';
      else out += '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
      continue;
    }
    out += ch;
  }
  return out;
}

// Tolerant parser: if the model returned prose instead of JSON, salvage the
// text as a clarifying response so the onboarding does not freeze.
export function parseAssistantPayload(rawText: string): any | null {
  if (!rawText) return null;
  const cleaned = rawText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();

  const candidates = [cleaned, escapeControlCharsInStrings(cleaned)];
  const braceStart = cleaned.indexOf('{');
  const braceEnd = cleaned.lastIndexOf('}');
  if (braceStart >= 0 && braceEnd > braceStart) {
    const slice = cleaned.slice(braceStart, braceEnd + 1);
    candidates.push(slice, escapeControlCharsInStrings(slice));
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch { /* try next candidate */ }
  }

  // Safety net: the blob still won't parse but clearly holds a `response`
  // field — extract its text so we never render raw JSON to the user.
  if (cleaned.includes('"response"')) {
    const match = cleaned.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*?)"\s*(?:,|})/);
    if (match) {
      const text = match[1]
        .replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, '\t')
        .replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      const typeMatch = cleaned.match(/"type"\s*:\s*"(clarification|proposal)"/);
      return { response: text, type: typeMatch ? typeMatch[1] : 'clarification' };
    }
  }

  const prose = cleaned.replace(/^[`"'\s]+|[`"'\s]+$/g, '');
  if (!prose) return null;
  return { response: prose, type: 'clarification' };
}

function userChoseToScheduleLater(messages: Array<{ role: string; content: string }>): boolean {
  const lastUser = [...messages].reverse().find((msg) => msg.role === 'user')?.content || '';
  const normalized = lastUser.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /\b(depois|mais tarde|sem horario agora|marcar depois|agendar depois|schedule later|later|not now)\b/.test(normalized);
}

export function enforceSchedulingConfirmation(
  result: any,
  lang: string,
  messages: Array<{ role: string; content: string }>,
): any {
  if (result?.type !== 'proposal') return result;
  if (userChoseToScheduleLater(messages)) return result;

  const proposal = result.proposalData || {};
  const preferredTime = typeof proposal.preferred_time === 'string' ? proposal.preferred_time.trim() : '';
  const weeklyRoutine = typeof proposal.weekly_routine === 'string' ? proposal.weekly_routine : '';
  const hasPreferredTime = /^\d{1,2}:\d{2}$/.test(preferredTime);
  const hasRoutineTime = Boolean(extractTimeRange(weeklyRoutine));

  if (hasPreferredTime) {
    return {
      ...result,
      proposalData: {
        ...proposal,
        preferred_time: preferredTime.padStart(5, '0'),
      },
    };
  }
  if (hasRoutineTime) return result;

  return {
    response: lang === 'pt'
      ? 'Perfeito. Antes de eu fechar isso, preciso combinar o horário exato para colocar na sua agenda. Que horas você quer fazer essa atividade todos os dias?'
      : 'Perfect. Before I lock this in, I need the exact time so I can put it on your calendar. What time do you want to do this activity each day?',
    type: 'clarification',
    proposalButtonText: '',
  };
}

// ─── Gemini via REST API (Primary) ────────────────────────────────────
async function callGemini(systemPrompt: string, messages: Array<{ role: string; content: string }>): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('No GEMINI_API_KEY');

  const contents = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      temperature: 0.7,
      responseMimeType: 'application/json',
    },
  };

  const models = ['gemini-2.5-flash', 'gemini-2.5-pro'];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        console.warn(`Gemini model ${model} failed (${res.status}), trying next...`);
        continue;
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!rawText) continue;

      const parsed = parseAssistantPayload(rawText);
      if (parsed && parsed.response) return parsed;
    } catch (err) {
      console.warn(`Gemini model ${model} error:`, err);
      continue;
    }
  }

  throw new Error('All Gemini models failed');
}

// ─── Grok (xAI) fallback when OpenAI quota is unavailable ────────────
async function callGrok(systemPrompt: string, messages: Array<{ role: string; content: string }>): Promise<any> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error('No XAI_API_KEY');

  const openai = new OpenAI({ apiKey, baseURL: 'https://api.x.ai/v1' });
  const grokMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map((msg) => ({
      role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg.content,
    })),
  ];

  const completion = await openai.chat.completions.create({
    model: 'grok-4-fast',
    temperature: 0.7,
    response_format: { type: 'json_object' },
    messages: grokMessages,
  });

  const outputText = completion.choices[0]?.message?.content || '';
  return parseAssistantPayload(outputText) || { response: '', type: 'silent_fail' };
}

// ─── OpenAI (Fallback) ───────────────────────────────────────────────
async function callOpenAI(systemPrompt: string, messages: Array<{ role: string; content: string }>): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('No OPENAI_API_KEY');

  const openai = new OpenAI({ apiKey });

  const openaiMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map(msg => ({
      role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg.content,
    })),
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    response_format: { type: 'json_object' },
    messages: openaiMessages,
  });

  const outputText = completion.choices[0]?.message?.content || '{}';
  return parseAssistantPayload(outputText) || { response: '', type: 'silent_fail' };
}

// ─── Route Handler ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { history, userMessage, lang = 'pt', priorProposals, timezone } = await req.json();

    if (!userMessage) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const priors: PriorProposal[] = Array.isArray(priorProposals) ? priorProposals.filter(Boolean) : [];
    let availabilityBlock = '';
    try {
      const auth = await requireAuth(req).catch(() => null);
      if (auth) {
        availabilityBlock = await getCalendarAvailabilityText(
          auth.supabase as any,
          auth.user.id,
          typeof timezone === 'string' && timezone ? timezone : 'UTC',
          lang === 'en' ? 'en' : 'pt',
          14,
        );
      }
    } catch (err) {
      console.warn('[onboarding/assistant] availability lookup failed (non-fatal):', err);
    }
    const systemPrompt = getSystemPrompt(lang) + availabilityBlock + formatPriorProposals(priors, lang);

    // Build unified message array
    const messages: Array<{ role: string; content: string }> = [];
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        if (!msg.content) continue;
        messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
      }
    }
    messages.push({ role: 'user', content: userMessage });

    // Strategy: Gemini first → retry Gemini → OpenAI fallback → empty (silent)
    let result: any = null;

    // 1. Try Gemini (primary)
    try {
      result = await callGemini(systemPrompt, messages);
    } catch (geminiErr) {
      console.warn('Gemini attempt 1 failed:', geminiErr);
    }

    // 2. Retry Gemini once after a short delay (transient failures)
    if (!result || !result.response) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        result = await callGemini(systemPrompt, messages);
      } catch (geminiErr2) {
        console.warn('Gemini attempt 2 failed:', geminiErr2);
      }
    }

    // 3. Try Grok (xAI) when configured — useful when OpenAI quota is dry
    if ((!result || !result.response) && process.env.XAI_API_KEY) {
      try {
        result = await callGrok(systemPrompt, messages);
      } catch (grokErr) {
        console.warn('Grok also failed:', grokErr);
      }
    }

    // 4. Try OpenAI (last fallback)
    if (!result || !result.response) {
      try {
        result = await callOpenAI(systemPrompt, messages);
      } catch (openaiErr) {
        console.warn('OpenAI also failed:', openaiErr);
      }
    }

    // 4. If everything failed, return empty — frontend handles silently
    if (!result || !result.response) {
      result = { response: '', type: 'silent_fail' };
    }
    result = enforceSchedulingConfirmation(result, lang, messages);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Critical error in Balys AI Assistant:', error);
    return NextResponse.json({ response: '', type: 'silent_fail' });
  }
}
