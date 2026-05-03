import { z } from 'zod';

export const UserProfileSchema = z.object({
  priorities: z.array(z.string().min(1).max(200)).max(10).default([]),
  ongoing_work: z
    .array(z.object({
      title: z.string().min(1).max(160),
      status: z.string().min(1).max(120).optional(),
      since: z.string().max(40).optional(),
    }))
    .max(10)
    .default([]),
  important_people: z
    .array(z.object({
      name: z.string().min(1).max(80),
      relation: z.string().min(1).max(80).optional(),
    }))
    .max(20)
    .default([]),
  recent_decisions: z
    .array(z.object({
      decision: z.string().min(1).max(240),
      when: z.string().max(40).optional(),
    }))
    .max(8)
    .default([]),
  communication_style: z.string().max(280).default(''),
  last_updated_summary: z.string().max(400).default(''),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

export const EMPTY_PROFILE: UserProfile = UserProfileSchema.parse({});

export async function loadProfile(supabase: any, userId: string): Promise<UserProfile> {
  try {
    const { data, error } = await supabase
      .from('user_profile')
      .select('profile')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return EMPTY_PROFILE;
    const parsed = UserProfileSchema.safeParse(data.profile);
    return parsed.success ? parsed.data : EMPTY_PROFILE;
  } catch (e) {
    console.error('[memory.profile] loadProfile failed:', e);
    return EMPTY_PROFILE;
  }
}

export function profileIsEmpty(profile: UserProfile): boolean {
  return (
    profile.priorities.length === 0 &&
    profile.ongoing_work.length === 0 &&
    profile.important_people.length === 0 &&
    profile.recent_decisions.length === 0 &&
    profile.communication_style.trim().length === 0
  );
}

export function renderProfileForPrompt(profile: UserProfile): string {
  if (profileIsEmpty(profile)) return '';
  const lines: string[] = ['## Living user profile (always loaded)', ''];

  if (profile.priorities.length > 0) {
    lines.push('**Current priorities:**');
    for (const p of profile.priorities) lines.push(`- ${p}`);
    lines.push('');
  }
  if (profile.ongoing_work.length > 0) {
    lines.push('**Ongoing work:**');
    for (const w of profile.ongoing_work) {
      const meta = [w.status, w.since].filter(Boolean).join(', ');
      lines.push(`- ${w.title}${meta ? ` (${meta})` : ''}`);
    }
    lines.push('');
  }
  if (profile.important_people.length > 0) {
    lines.push('**Important people:**');
    for (const p of profile.important_people) {
      lines.push(`- ${p.name}${p.relation ? ` — ${p.relation}` : ''}`);
    }
    lines.push('');
  }
  if (profile.recent_decisions.length > 0) {
    lines.push('**Recent decisions:**');
    for (const d of profile.recent_decisions) {
      lines.push(`- ${d.decision}${d.when ? ` (${d.when})` : ''}`);
    }
    lines.push('');
  }
  if (profile.communication_style.trim().length > 0) {
    lines.push(`**Communication style:** ${profile.communication_style.trim()}`);
    lines.push('');
  }
  if (profile.last_updated_summary.trim().length > 0) {
    lines.push(`**Last update:** ${profile.last_updated_summary.trim()}`);
  }
  return lines.join('\n').trim();
}

const PROFILE_UPDATER_SYSTEM_PROMPT = `You are the "profile updater" subroutine of a personal AI assistant called Balys.

You receive:
1. The user's CURRENT profile JSON
2. A recent conversation transcript

Your job: return an UPDATED profile JSON with HIGH-CONFIDENCE additions or refinements based on the conversation. The profile is the assistant's long-term memory of who the user is — keep it accurate, terse, durable.

STRICT RULES:
- Output ONLY valid JSON matching the exact same shape as the input. No prose, no markdown, no explanation.
- Only add facts the user clearly stated about themselves or that are unambiguous from context.
- NEVER fabricate. NEVER infer relationships, priorities, or decisions that weren't explicitly mentioned.
- DO NOT delete existing entries unless the user contradicted them. If unsure, KEEP the existing entry.
- Cap each array at the existing schema limits (priorities=10, ongoing_work=10, important_people=20, recent_decisions=8). When at the cap and adding something genuinely new, drop the oldest entry.
- 'communication_style' is a single sentence describing how the user prefers to communicate (e.g. "concise, direct, prefers Portuguese, OK with mild swearing"). Refine only with strong evidence.
- 'last_updated_summary' should be ONE short sentence describing what changed in this update (used for debugging — keep it under 200 chars).
- If nothing meaningful changed, return the input profile UNCHANGED.

Output the JSON object directly. No preamble.`;

export interface UpdateProfileInput {
  current: UserProfile;
  conversationText: string;
  apiKey?: string;
}

export interface UpdateProfileResult {
  updated: UserProfile;
  changed: boolean;
  reason?: string;
}

/**
 * Validates a proposed profile change against the current one.
 * Anti-drift: rejects suspicious mass-deletions.
 * Returns the next profile to use (either the proposal, or current with selective fields rejected).
 */
export function validateProfileChange(prior: UserProfile, next: UserProfile): UserProfile {
  const out: UserProfile = normalizeProfile(next);

  const arrayFields: Array<keyof Pick<UserProfile, 'priorities' | 'ongoing_work' | 'important_people' | 'recent_decisions'>> = [
    'priorities',
    'ongoing_work',
    'important_people',
    'recent_decisions',
  ];

  for (const field of arrayFields) {
    const priorArr = prior[field] as unknown[];
    const nextArr = out[field] as unknown[];
    if (priorArr.length >= 3 && nextArr.length < priorArr.length / 2) {
      // Suspicious mass deletion — keep the prior values for this field.
      console.warn(`[memory.profile] Rejected suspicious mass deletion of '${field}': prior=${priorArr.length} next=${nextArr.length}. Keeping prior.`);
      (out as any)[field] = priorArr;
    }
  }

  if (prior.communication_style.trim() && !out.communication_style.trim()) {
    out.communication_style = prior.communication_style;
  }

  return out;
}

export function normalizeProfile(profile: UserProfile): UserProfile {
  return {
    priorities: dedupeStrings(profile.priorities).slice(0, 10),
    ongoing_work: dedupeObjects(profile.ongoing_work, (item) => item.title).slice(0, 10),
    important_people: dedupeObjects(profile.important_people, (item) => item.name).slice(0, 20),
    recent_decisions: dedupeObjects(profile.recent_decisions, (item) => item.decision).slice(0, 8),
    communication_style: cleanText(profile.communication_style).slice(0, 280),
    last_updated_summary: cleanText(profile.last_updated_summary).slice(0, 400),
  };
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const cleaned = cleanText(value);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function dedupeObjects<T extends Record<string, unknown>>(values: T[], keyFn: (item: T) => unknown): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const value of values) {
    const key = cleanText(String(keyFn(value) || '')).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(cleanObjectStrings(value));
  }
  return out;
}

function cleanObjectStrings<T extends Record<string, unknown>>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = typeof val === 'string' ? cleanText(val) : val;
  }
  return out as T;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export async function callProfileUpdater(input: UpdateProfileInput): Promise<UpdateProfileResult> {
  const apiKey = input.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { updated: input.current, changed: false, reason: 'OPENAI_API_KEY missing' };
  }

  const userMessage = `CURRENT PROFILE (JSON):
${JSON.stringify(input.current, null, 2)}

RECENT CONVERSATION:
${input.conversationText.slice(0, 12000)}

Return the updated JSON profile now.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: PROFILE_UPDATER_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { updated: input.current, changed: false, reason: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return { updated: input.current, changed: false, reason: 'empty response' };

    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch (e) {
      return { updated: input.current, changed: false, reason: 'invalid JSON from updater' };
    }

    const validated = UserProfileSchema.safeParse(parsed);
    if (!validated.success) {
      return { updated: input.current, changed: false, reason: `schema mismatch: ${validated.error.message.slice(0, 200)}` };
    }

    const safe = validateProfileChange(input.current, validated.data);
    const changed = JSON.stringify(safe) !== JSON.stringify(input.current);
    return { updated: safe, changed };
  } catch (e: any) {
    return { updated: input.current, changed: false, reason: e?.message || String(e) };
  }
}

/**
 * Persists a profile update to Supabase. Increments version. Updates last_updated_at.
 * Best-effort — logs but never throws.
 */
export async function persistProfile(supabase: any, userId: string, updated: UserProfile): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('user_profile')
      .select('version')
      .eq('user_id', userId)
      .maybeSingle();

    const nextVersion = (existing?.version || 0) + 1;
    const { error } = await supabase
      .from('user_profile')
      .upsert({
        user_id: userId,
        profile: updated,
        version: nextVersion,
        last_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (error) console.error('[memory.profile] persist failed:', error);
  } catch (e) {
    console.error('[memory.profile] persist threw:', e);
  }
}
