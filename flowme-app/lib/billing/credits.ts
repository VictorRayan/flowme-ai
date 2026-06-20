import { computeCostUsd, estimateTokensFromText } from '@/lib/ai/billing';
import { FREE_AI_CREDITS_PER_DAY, getUserEntitlements } from './entitlements';

export const AI_CREDIT_COSTS = {
  simple_chat: 1,
  tool_action: 2,
  connector: 3,
  web_grounded: 4,
  image: 8,
} as const;

export type AiCreditSource = 'chat' | 'tool' | 'briefing' | 'review' | 'image' | 'meeting' | 'support';

export interface AiCreditState {
  allowed: boolean;
  plan_code: 'free' | 'pro';
  unlimited: boolean;
  daily_limit: number | null;
  used: number;
  remaining: number | null;
  local_date: string;
  timezone: string;
  resets_at: string;
}

export interface ConsumeAiCreditsInput {
  supabase: unknown;
  userId: string;
  timezone: string;
  source: AiCreditSource;
  featureKey: string;
  credits: number;
  provider?: string;
  model?: string;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  costUsdEstimate?: number;
  metadata?: Record<string, unknown>;
}

export function creditPreflightMessage(remaining: number | null, required: number, portuguese: boolean): string {
  if (remaining === 0) {
    return portuguese
      ? 'Seus créditos de IA de hoje acabaram. Eles renovam amanhã, ou você pode liberar IA ilimitada com Pro.'
      : 'You have used today’s AI credits. They renew tomorrow, or you can unlock unlimited AI with Pro.';
  }
  return portuguese
    ? `Essa ação usa ${required} créditos; você tem ${remaining}.`
    : `This action uses ${required} credits; you have ${remaining}.`;
}

type CreditQuery = {
  select(columns: string): CreditQuery;
  eq(column: string, value: string): CreditQuery;
  gte(column: string, value: string): CreditQuery;
  lt(column: string, value: string): Promise<{ data: Array<{ credits: number }> | null; error: { message?: string } | null }>;
};

type CreditClient = {
  from(table: string): CreditQuery;
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: AiCreditState | null; error: { message?: string } | null }>;
};

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function timezoneOffsetMs(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Date.UTC(
    Number(values.year), Number(values.month) - 1, Number(values.day),
    Number(values.hour), Number(values.minute), Number(values.second),
  ) - date.getTime();
}

function zonedMidnightUtc(date: string, timezone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day));
  const first = new Date(guess.getTime() - timezoneOffsetMs(guess, timezone));
  return new Date(guess.getTime() - timezoneOffsetMs(first, timezone));
}

export function getLocalDayWindow(now: Date, requestedTimezone: string): { timezone: string; localDate: string; start: Date; end: Date } {
  const timezone = isValidTimezone(requestedTimezone) ? requestedTimezone : 'UTC';
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const start = zonedMidnightUtc(localDate, timezone);
  const nextDate = new Date(`${localDate}T12:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const nextLocalDate = nextDate.toISOString().slice(0, 10);
  return { timezone, localDate, start, end: zonedMidnightUtc(nextLocalDate, timezone) };
}

export async function getAiCreditState(supabase: unknown, userId: string, timezone: string, now = new Date()): Promise<AiCreditState> {
  const window = getLocalDayWindow(now, timezone);
  const entitlements = await getUserEntitlements(supabase, userId, now);
  const client = supabase as CreditClient;
  const { data, error } = await client
    .from('ai_credit_events')
    .select('credits')
    .eq('user_id', userId)
    .gte('created_at', window.start.toISOString())
    .lt('created_at', window.end.toISOString());
  if (error) throw new Error(error.message || 'Failed to load AI credit usage');
  const used = (data || []).reduce((sum, event) => sum + Math.max(0, Number(event.credits) || 0), 0);
  return {
    allowed: true,
    plan_code: entitlements.has_pro ? 'pro' : 'free',
    unlimited: entitlements.has_pro,
    daily_limit: entitlements.has_pro ? null : FREE_AI_CREDITS_PER_DAY,
    used,
    remaining: entitlements.has_pro ? null : Math.max(0, FREE_AI_CREDITS_PER_DAY - used),
    local_date: window.localDate,
    timezone: window.timezone,
    resets_at: window.end.toISOString(),
  };
}

export async function consumeAiCredits(input: ConsumeAiCreditsInput): Promise<AiCreditState> {
  const client = input.supabase as CreditClient;
  const { data, error } = await client.rpc('consume_ai_credits', {
    p_user_id: input.userId,
    p_timezone: isValidTimezone(input.timezone) ? input.timezone : 'UTC',
    p_source: input.source,
    p_feature_key: input.featureKey,
    p_credits: input.credits,
    p_provider: input.provider || null,
    p_model: input.model || null,
    p_estimated_input_tokens: input.estimatedInputTokens ?? null,
    p_estimated_output_tokens: input.estimatedOutputTokens ?? null,
    p_cost_usd_estimate: input.costUsdEstimate ?? null,
    p_metadata: input.metadata || {},
  });
  if (error || !data) throw new Error(error?.message || 'Failed to consume AI credits');
  return data;
}

export function classifyBalysCreditCost(input: {
  action?: string | null;
  needsTools: boolean;
  toolDomain?: string | null;
}): { credits: number; source: AiCreditSource; featureKey: string } {
  if (input.action === 'image') return { credits: AI_CREDIT_COSTS.image, source: 'image', featureKey: 'image_generation' };
  if (['gmail', 'drive', 'docs', 'sheets', 'slack'].includes(input.action || '') || input.toolDomain === 'connectors' || input.toolDomain === 'gmail') {
    return { credits: AI_CREDIT_COSTS.connector, source: 'tool', featureKey: 'connector_read' };
  }
  if (input.toolDomain === 'web') return { credits: AI_CREDIT_COSTS.web_grounded, source: 'tool', featureKey: 'web_grounded' };
  if (input.needsTools || Boolean(input.action)) return { credits: AI_CREDIT_COSTS.tool_action, source: 'tool', featureKey: 'balys_tool' };
  return { credits: AI_CREDIT_COSTS.simple_chat, source: 'chat', featureKey: 'balys_text' };
}

export function estimateBalysCreditUsage(input: {
  text: string;
  provider: string;
  model: string;
  action?: string | null;
  needsTools: boolean;
  toolDomain?: string | null;
}) {
  const classification = classifyBalysCreditCost(input);
  const estimatedInputTokens = estimateTokensFromText(input.text);
  const estimatedOutputTokens = Math.max(128, Math.min(1024, estimatedInputTokens * 2));
  const costUsdEstimate = input.provider === 'openai' || input.provider === 'gemini'
    ? computeCostUsd({ provider: input.provider, model: input.model, promptTokens: estimatedInputTokens, completionTokens: estimatedOutputTokens })
    : undefined;
  return { ...classification, estimatedInputTokens, estimatedOutputTokens, costUsdEstimate };
}
