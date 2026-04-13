import type { User } from '@supabase/supabase-js';

type Price = { input: number; output: number }; // USD per 1M tokens

const OPENAI_PRICES: Record<string, Price> = {
  'gpt-4o': { input: 5, output: 15 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-5.4-nano': { input: 0.2, output: 1.25 },
  'gpt-5.4-mini': { input: 0.75, output: 4.5 },
  'gpt-5.4': { input: 2.5, output: 15 },
  'whisper-1': { input: 0, output: 0 },
};

const GEMINI_PRICES: Record<string, Price> = {
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.3 },
  'gemini-2.5-flash': { input: 0.3, output: 1.2 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  'gemini-2.5-pro': { input: 1.25, output: 5 },
  'gemini-3-flash-preview': { input: 0.3, output: 1.2 },
  'gemini-3-pro-preview': { input: 1.25, output: 5 },
  'gemini-3.1-pro-preview': { input: 1.25, output: 5 },
  'gemini-pro-latest': { input: 0.5, output: 1.5 },
  'gemini-flash-latest': { input: 0.3, output: 1.2 },
};

function getPrice(provider: 'openai' | 'gemini', model: string): Price {
  const map = provider === 'openai' ? OPENAI_PRICES : GEMINI_PRICES;
  return map[model] || { input: 0.5, output: 1.5 };
}

export function estimateTokensFromText(text: string): number {
  // Approximation: 1 token ~= 4 chars
  return Math.max(1, Math.ceil((text || '').length / 4));
}

export function computeCostUsd(opts: {
  provider: 'openai' | 'gemini';
  model: string;
  promptTokens: number;
  completionTokens: number;
}): number {
  const price = getPrice(opts.provider, opts.model);
  const inCost = (opts.promptTokens / 1_000_000) * price.input;
  const outCost = (opts.completionTokens / 1_000_000) * price.output;
  return Number((inCost + outCost).toFixed(6));
}

export async function resolveDefaultLinkedAccountId(
  supabase: any,
  user: User
): Promise<string | null> {
  const { data, error } = await supabase
    .from('linked_accounts')
    .select('id, name, is_active, user_google_tokens(linked_account_id)')
    .eq('user_id', user.id)
    .eq('is_deleted', false)
    .eq('provider', 'google')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error || !data?.length) return null;

  const connected = data.filter((acc: any) => Array.isArray(acc.user_google_tokens) ? acc.user_google_tokens.length > 0 : !!acc.user_google_tokens);
  if (!connected.length) return null;

  const emailMatch = connected.find((acc: any) => String(acc.name || '').toLowerCase() === String(user.email || '').toLowerCase());
  return (emailMatch || connected[0]).id;
}

export async function logAiUsage(opts: {
  supabase: any;
  user: User;
  feature: 'chat' | 'transcribe';
  provider: 'openai' | 'gemini';
  model: string;
  promptTokens: number;
  completionTokens: number;
  metadata?: Record<string, unknown>;
}) {
  const totalTokens = Math.max(0, opts.promptTokens + opts.completionTokens);
  const costUsd = computeCostUsd({
    provider: opts.provider,
    model: opts.model,
    promptTokens: opts.promptTokens,
    completionTokens: opts.completionTokens,
  });

  const linkedAccountId = await resolveDefaultLinkedAccountId(opts.supabase, opts.user);

  const { error } = await opts.supabase.from('ai_usage_logs').insert({
    user_id: opts.user.id,
    linked_account_id: linkedAccountId,
    feature: opts.feature,
    provider: opts.provider,
    model: opts.model,
    prompt_tokens: opts.promptTokens,
    completion_tokens: opts.completionTokens,
    total_tokens: totalTokens,
    cost_usd: costUsd,
    metadata: opts.metadata || {},
  });

  if (error) {
    console.error('[ai_usage_logs] insert failed:', error.message);
  }
}

export function usdToBrl(usd: number, rate = 5.0): number {
  return Number((usd * rate).toFixed(2));
}
