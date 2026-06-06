import { runAiCouncilPipeline } from '@/lib/ai/council-agents';
import { getFinanceMonthlySummary } from '@/lib/finance/finance';
import type { FinanceMonthlySummary } from '@/lib/finance/types';

export type MonthlyReviewStatus = 'generating' | 'ready' | 'failed';

export interface MonthlyReviewPeriod {
  start: string;
  end: string;
}

export interface MonthlyReviewEvidence {
  evidence_version?: number;
  period: MonthlyReviewPeriod;
  financial_summary: FinanceMonthlySummary;
  income_missing: boolean;
  needs_review_count: number;
  alerts: string[];
}

export interface MonthlyReviewContent {
  financial_health: string;
  spending_pattern: string;
  investment_guidance: string;
  cuts_to_consider: string;
  next_month_focus: string;
  council_mode: string;
}

export interface MonthlyReviewRecord {
  id?: string;
  user_id: string;
  period_start: string;
  period_end: string;
  status: MonthlyReviewStatus;
  evidence: MonthlyReviewEvidence;
  review_content: MonthlyReviewContent | null;
  delivered_at?: string | null;
}

type SupabaseLike = { from(table: string): any };
const CURRENT_EVIDENCE_VERSION = 2;

function dateInTimezone(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function lastDayOfMonth(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex + 1, 0, 12)).toISOString().slice(0, 10);
}

function previousMonthFromDate(localDate: string): string {
  const date = new Date(`${localDate.slice(0, 7)}-01T12:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}

export function getClosedMonthlyReviewPeriod(now: Date, timezone: string): MonthlyReviewPeriod {
  const today = dateInTimezone(now, timezone);
  const date = new Date(`${today.slice(0, 7)}-01T12:00:00.000Z`);
  const todayLastDay = lastDayOfMonth(date.getUTCFullYear(), date.getUTCMonth());
  const month = today === todayLastDay ? today.slice(0, 7) : previousMonthFromDate(today);
  return {
    start: `${month}-01`,
    end: lastDayOfMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1),
  };
}

function isLastDayInTimezone(now: Date, timezone: string): boolean {
  const today = dateInTimezone(now, timezone);
  const parsed = new Date(`${today}T12:00:00.000Z`);
  return today === lastDayOfMonth(parsed.getUTCFullYear(), parsed.getUTCMonth());
}

function isDue(time: string | null, now: Date, timezone: string): boolean {
  if (!time) return false;
  const local = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  return local === time && isLastDayInTimezone(now, timezone);
}

async function rows<T>(query: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const { data } = await query;
  return data || [];
}

export function buildMonthlyReviewEvidence(summary: FinanceMonthlySummary): MonthlyReviewEvidence {
  const alerts: string[] = [];
  const recurringExpenses = summary.recurring_expenses || [];
  if (summary.needs_review_count > 0) alerts.push(`${summary.needs_review_count} lançamentos precisam de revisão.`);
  if (summary.total_income <= 0 && summary.total_expenses > 0) alerts.push('Renda mensal não registrada; não calcule recomendação precisa de investimento.');
  if (summary.category_breakdown[0]?.share >= 0.4) alerts.push(`Categoria dominante: ${summary.category_breakdown[0].category}.`);
  if (recurringExpenses.length > 0) {
    const recurringTotal = recurringExpenses.reduce((total, item) => total + item.monthly_impact, 0);
    alerts.push(`Custos recorrentes detectados: ${recurringTotal.toFixed(2)} ${summary.currency}/mês estimados.`);
  }
  for (const alignment of summary.goal_alignment || []) {
    if (alignment.status === 'behind') {
      alerts.push(`Meta financeira abaixo do ritmo: ${alignment.goal_title}. Faltaram ${Math.abs(alignment.gap)} ${alignment.currency} no mês.`);
    }
  }
  return {
    evidence_version: CURRENT_EVIDENCE_VERSION,
    period: { start: `${summary.month}-01`, end: lastDayOfMonth(Number(summary.month.slice(0, 4)), Number(summary.month.slice(5, 7)) - 1) },
    financial_summary: summary,
    income_missing: summary.total_income <= 0,
    needs_review_count: summary.needs_review_count,
    alerts,
  };
}

export function buildMonthlyCouncilSituation(evidence: MonthlyReviewEvidence): string {
  return `Faça uma revisão mensal financeira prática para o usuário.
Use somente os dados financeiros estruturados abaixo. Não invente renda, gastos, investimentos ou taxa de investimento.
Se a renda estiver ausente, não recomende um valor exato para investir; recomende organizar renda e controlar categorias.
Tom: especialista de finanças pessoais, direto, sem julgamento moral. Foque em saúde financeira, cortes úteis, investimento e foco do próximo mês.

Período: ${evidence.period.start} a ${evidence.period.end}
Resumo financeiro: ${JSON.stringify(evidence.financial_summary)}
Alertas: ${JSON.stringify(evidence.alerts)}`;
}

async function defaultCouncilRunner(evidence: MonthlyReviewEvidence): Promise<{ directive: string; mode: string }> {
  const result = await runAiCouncilPipeline(buildMonthlyCouncilSituation(evidence), { mode: 'cheap' });
  return { directive: result.ceoDirective, mode: result.finalMode };
}

function fallbackContent(evidence: MonthlyReviewEvidence, council: { directive: string; mode: string }): MonthlyReviewContent {
  const summary = evidence.financial_summary;
  const top = summary.category_breakdown[0];
  const behindGoal = summary.goal_alignment.find(item => item.status === 'behind');
  const topRecurring = summary.recurring_expenses?.[0];
  return {
    financial_health: summary.total_income > 0
      ? `O mês fechou com saldo de ${summary.net_balance} ${summary.currency} e taxa de investimento de ${summary.investment_rate === null ? 0 : Math.round(summary.investment_rate * 100)}%.`
      : `O mês tem ${summary.total_expenses} ${summary.currency} em gastos registrados, mas sem renda registrada suficiente para medir saúde financeira completa.`,
    spending_pattern: top ? `A maior categoria foi ${top.category}, com ${top.amount} ${summary.currency}.` : 'Não há despesas suficientes para detectar padrão forte.',
    investment_guidance: summary.total_income > 0
      ? council.directive
      : 'Antes de definir quanto investir, registre sua renda mensal. Enquanto isso, controle categorias variáveis e preserve caixa.',
    cuts_to_consider: topRecurring
      ? `Revise primeiro o custo recorrente "${topRecurring.label}", estimado em ${topRecurring.monthly_impact} ${topRecurring.currency}/mês. Depois compare com ${top?.category || 'as maiores categorias'} para cortes variáveis.`
      : top ? `Revise ${top.category} primeiro, porque é onde um ajuste pequeno pode ter maior impacto.` : 'Sem cortes específicos detectados.',
    next_month_focus: behindGoal
      ? `Recuperar aderência à meta "${behindGoal.goal_title}": alvo mensal ${behindGoal.monthly_target} ${behindGoal.currency}, realizado ${behindGoal.actual_saved} ${behindGoal.currency}. ${council.directive}`
      : council.directive,
    council_mode: council.mode,
  };
}

export async function generateMonthlyReviewContent(
  evidence: MonthlyReviewEvidence,
  councilRunner: (evidence: MonthlyReviewEvidence) => Promise<{ directive: string; mode: string }> = defaultCouncilRunner,
): Promise<{ status: MonthlyReviewStatus; review_content: MonthlyReviewContent | null }> {
  const council = await councilRunner(evidence);
  return { status: 'ready', review_content: fallbackContent(evidence, council) };
}

async function persistMonthlyReview(supabase: SupabaseLike, review: MonthlyReviewRecord): Promise<MonthlyReviewRecord> {
  const { data, error } = await supabase.from('monthly_reviews').upsert({
    user_id: review.user_id,
    period_start: review.period_start,
    period_end: review.period_end,
    status: review.status,
    evidence: review.evidence,
    review_content: review.review_content,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,period_start,period_end' }).select('*').single();
  if (error) throw new Error(error.message || 'Failed to persist monthly review');
  return data as MonthlyReviewRecord;
}

export async function getLatestMonthlyReview(supabase: SupabaseLike, userId: string): Promise<MonthlyReviewRecord | null> {
  const { data } = await supabase.from('monthly_reviews').select('*').eq('user_id', userId).order('period_end', { ascending: false }).limit(1).maybeSingle();
  return (data || null) as MonthlyReviewRecord | null;
}

export async function ensureMonthlyReview(
  supabase: SupabaseLike,
  userId: string,
  options: { now?: Date; timezone?: string; period?: MonthlyReviewPeriod; councilRunner?: (evidence: MonthlyReviewEvidence) => Promise<{ directive: string; mode: string }> } = {},
): Promise<MonthlyReviewRecord> {
  const now = options.now || new Date();
  const period = options.period || getClosedMonthlyReviewPeriod(now, options.timezone || 'UTC');
  const month = period.start.slice(0, 7);
  const summary = await getFinanceMonthlySummary(supabase, userId, month);
  const evidence = buildMonthlyReviewEvidence(summary);
  try {
    const generated = await generateMonthlyReviewContent(evidence, options.councilRunner);
    return persistMonthlyReview(supabase, {
      user_id: userId,
      period_start: period.start,
      period_end: period.end,
      evidence,
      ...generated,
    });
  } catch (error) {
    console.error('[monthly-review] generation failed:', error);
    return persistMonthlyReview(supabase, {
      user_id: userId,
      period_start: period.start,
      period_end: period.end,
      status: 'failed',
      evidence,
      review_content: null,
    });
  }
}

export async function generateDueMonthlyReviews(
  supabase: SupabaseLike,
  now = new Date(),
  options: { councilRunner?: (evidence: MonthlyReviewEvidence) => Promise<{ directive: string; mode: string }> } = {},
): Promise<{ inspected: number; generated: number; failed: number }> {
  const profiles = await rows<{ user_id: string; briefing_timezone: string | null; monthly_review_enabled: boolean; monthly_review_time: string | null }>(
    supabase.from('user_profile').select('user_id, briefing_timezone, monthly_review_enabled, monthly_review_time').eq('monthly_review_enabled', true),
  );
  let inspected = 0;
  let generated = 0;
  let failed = 0;
  for (const profile of profiles) {
    const timezone = profile.briefing_timezone || 'UTC';
    if (!isDue(profile.monthly_review_time, now, timezone)) continue;
    inspected += 1;
    const review = await ensureMonthlyReview(supabase, profile.user_id, { now, timezone, councilRunner: options.councilRunner });
    if (review.status === 'ready') generated += 1;
    else failed += 1;
  }
  return { inspected, generated, failed };
}
