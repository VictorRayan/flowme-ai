import { runAiCouncilPipeline } from '@/lib/ai/council-agents';
import { buildFinanceSummary, getFinancialProfile, getFinanceMonthlySummary, listFinancialTransactions } from '@/lib/finance/finance';
import type { FinanceRecurringExpense, FinancialGoalAlignment } from '@/lib/finance/types';
import { getCalendarEvents } from '@/lib/google/google-calendar';
import { isCalendarLinkedAccountName } from '@/lib/google/linked-account-kind';
import { getUserEntitlements, isFeatureAllowed } from '@/lib/billing/entitlements';

export type WeeklyReviewStatus = 'collecting' | 'awaiting_briefing' | 'generating' | 'ready' | 'failed';

export interface WeeklyReviewPeriod {
  start: string;
  end: string;
}

interface NoteEvidence {
  title: string;
  note_type: string;
  note_date: string | null;
  content_text: string | null;
}

interface CommitmentEvidence {
  title: string;
  start_at: string;
  end_at: string;
  outcome: string;
  outcome_reason: string | null;
  reason_code: string | null;
}

interface RescheduleEvidence {
  title: string;
  movement_type: string;
  offset_minutes: number;
  minutes_before_previous_start: number;
}

interface GoalEvidence {
  title: string;
  status: string;
  starts_on?: string | null;
  due_on?: string | null;
  target_date?: string | null;
}

interface ActionPlanTaskEvidence {
  title: string;
  outcome: string;
}

interface ThreadSummaryEvidence {
  summary: string;
  key_topics: string[];
}

interface MeetingEvidence {
  title: string;
  subject: string | null;
  objective: string | null;
}

export interface FinancialReviewEvidence {
  currency: string;
  period_income: number;
  period_expenses: number;
  period_invested: number;
  month_to_date_income: number;
  month_to_date_expenses: number;
  month_to_date_invested: number;
  investment_rate_month_to_date: number | null;
  top_categories: Array<{ category: string; amount: number; share: number }>;
  largest_expenses: Array<{ label: string; amount: number; occurred_on: string; category: string }>;
  goal_alignment: FinancialGoalAlignment[];
  recurring_expenses: FinanceRecurringExpense[];
  needs_review_count: number;
  alerts: string[];
}

export interface WeeklyReviewMetrics {
  commitment_count: number;
  completed_count: number;
  not_done_count: number;
  unanswered_count: number;
  postponed_count: number;
  advanced_count: number;
  late_postponement_count: number;
}

export interface WeeklyReviewEvidence {
  evidence_version?: number;
  period: WeeklyReviewPeriod;
  metrics: WeeklyReviewMetrics;
  not_done_reasons: Array<{ reason: string; count: number }>;
  notes: NoteEvidence[];
  daily_briefings: NoteEvidence[];
  commitments: CommitmentEvidence[];
  reschedules: RescheduleEvidence[];
  goals: GoalEvidence[];
  action_plan_tasks: ActionPlanTaskEvidence[];
  thread_summaries: ThreadSummaryEvidence[];
  meetings: MeetingEvidence[];
  financial: FinancialReviewEvidence | null;
  weekly_briefing: string | null;
  has_narrative_context: boolean;
}

export interface WeeklyReviewContent {
  what_happened: string;
  detected_pattern: string;
  evidence_summary: WeeklyReviewMetrics;
  goal_impact: string;
  recommendation: string;
  council_mode: string;
  simple_next_step: boolean;
}

export interface WeeklyReviewRecord {
  id?: string;
  user_id: string;
  period_start: string;
  period_end: string;
  status: WeeklyReviewStatus;
  evidence: WeeklyReviewEvidence;
  review_content: WeeklyReviewContent | null;
  suggested_action_plan: Record<string, unknown> | null;
  delivered_at?: string | null;
}

interface BuildEvidenceInput {
  period: WeeklyReviewPeriod;
  notes: NoteEvidence[];
  commitments: CommitmentEvidence[];
  reschedules: RescheduleEvidence[];
  goals: GoalEvidence[];
  actionPlanTasks: ActionPlanTaskEvidence[];
  threadSummaries: ThreadSummaryEvidence[];
  meetings: MeetingEvidence[];
  financial?: FinancialReviewEvidence | null;
  weeklyBriefing: string | null;
}

interface CouncilReviewResult {
  directive: string;
  mode: string;
}

type SupabaseLike = { from(table: string): any };
const CURRENT_EVIDENCE_VERSION = 4;

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

function addDays(date: string, amount: number): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return parsed.toISOString().slice(0, 10);
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

export function getWeeklyReviewPeriod(now: Date, timezone: string): WeeklyReviewPeriod {
  const end = dateInTimezone(now, timezone);
  return { start: addDays(end, -6), end };
}

function yearFromDate(value: string | null | undefined): string | null {
  return value?.match(/^\d{4}/)?.[0] || null;
}

function hasConflictingTitleYear(goal: GoalEvidence): boolean {
  const structuredYear = yearFromDate(goal.due_on) || yearFromDate(goal.target_date);
  if (!structuredYear) return false;
  return Array.from(goal.title.matchAll(/\b(?:19|20)\d{2}\b/g)).some(match => match[0] !== structuredYear);
}

export function filterGoalsForWeeklyReview(goals: GoalEvidence[], period: WeeklyReviewPeriod): GoalEvidence[] {
  return goals.filter(goal => {
    if (goal.status === 'completed' || goal.status === 'cancelled') return false;
    if (goal.starts_on && goal.starts_on > period.end) return false;
    if (goal.due_on && goal.due_on < period.start) return false;
    return !hasConflictingTitleYear(goal);
  });
}

export function hasCurrentWeeklyReviewEvidence(evidence: Pick<WeeklyReviewEvidence, 'evidence_version'> | null | undefined): boolean {
  return evidence?.evidence_version === CURRENT_EVIDENCE_VERSION;
}

export function buildWeeklyReviewEvidence(input: BuildEvidenceInput): WeeklyReviewEvidence {
  const reasons = new Map<string, number>();
  for (const item of input.commitments) {
    if (item.outcome !== 'not_done' && item.outcome !== 'skipped') continue;
    const reason = item.reason_code || item.outcome_reason || 'unspecified';
    reasons.set(reason, (reasons.get(reason) || 0) + 1);
  }
  const dailyBriefings = input.notes.filter(note => note.note_type === 'daily_briefing' && hasText(note.content_text));
  const usefulNotes = input.notes.filter(note => hasText(note.content_text));
  return {
    evidence_version: CURRENT_EVIDENCE_VERSION,
    period: input.period,
    metrics: {
      commitment_count: input.commitments.length,
      completed_count: input.commitments.filter(item => item.outcome === 'completed').length,
      not_done_count: input.commitments.filter(item => item.outcome === 'not_done' || item.outcome === 'skipped').length,
      unanswered_count: input.commitments.filter(item => item.outcome === 'incomplete' || item.outcome === 'pending').length,
      postponed_count: input.reschedules.filter(item => item.movement_type === 'postponed').length,
      advanced_count: input.reschedules.filter(item => item.movement_type === 'advanced').length,
      late_postponement_count: input.reschedules.filter(item => item.movement_type === 'postponed' && item.minutes_before_previous_start <= 24 * 60).length,
    },
    not_done_reasons: Array.from(reasons.entries()).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    notes: usefulNotes,
    daily_briefings: dailyBriefings,
    commitments: input.commitments,
    reschedules: input.reschedules,
    goals: input.goals,
    action_plan_tasks: input.actionPlanTasks,
    thread_summaries: input.threadSummaries,
    meetings: input.meetings,
    financial: input.financial || null,
    weekly_briefing: input.weeklyBriefing,
    has_narrative_context: usefulNotes.length > 0 || hasText(input.weeklyBriefing),
  };
}

function summarizeWhatHappened(evidence: WeeklyReviewEvidence): string {
  const m = evidence.metrics;
  return `${m.commitment_count} compromissos analisados: ${m.completed_count} feitos, ${m.not_done_count} não feitos e ${m.unanswered_count} sem resposta.`;
}

function summarizePattern(evidence: WeeklyReviewEvidence): string {
  const m = evidence.metrics;
  if (m.late_postponement_count > 0) return `${m.late_postponement_count} adiamentos aconteceram com menos de 24 horas de antecedência.`;
  if (m.not_done_count > 0) return `${m.not_done_count} compromissos não foram concluídos e precisam de ajuste na próxima semana.`;
  if (m.unanswered_count > 0) return `${m.unanswered_count} compromissos ficaram sem confirmação de execução.`;
  return 'A semana não apresentou um desvio recorrente forte nos registros disponíveis.';
}

function summarizeGoalImpact(evidence: WeeklyReviewEvidence): string {
  const activeGoals = evidence.goals.filter(goal => goal.status !== 'completed' && goal.status !== 'cancelled');
  if (activeGoals.length === 0) return 'Não há metas ativas suficientes para medir impacto direto.';
  return `Os desvios devem ser avaliados contra ${activeGoals.length} metas ativas: ${activeGoals.map(goal => goal.title).slice(0, 3).join(', ')}.`;
}

async function collectFinancialReviewEvidence(
  supabase: SupabaseLike,
  userId: string,
  period: WeeklyReviewPeriod,
): Promise<FinancialReviewEvidence | null> {
  try {
    const profile = await getFinancialProfile(supabase, userId);
    const month = period.end.slice(0, 7);
    const periodTransactions = await listFinancialTransactions(supabase, userId, { start: period.start, end: period.end, limit: 500 });
    const periodSummary = buildFinanceSummary(periodTransactions, { month, currency: profile.default_currency });
    const monthSummary = await getFinanceMonthlySummary(supabase, userId, month);
    const alerts: string[] = [];
    if (monthSummary.needs_review_count > 0) alerts.push(`${monthSummary.needs_review_count} lançamentos financeiros precisam de revisão.`);
    if (monthSummary.total_income <= 0 && monthSummary.total_expenses > 0) alerts.push('Renda mensal não registrada; recomendações de investimento devem ser conservadoras.');
    if (monthSummary.recurring_expenses.length > 0) {
      const recurringTotal = monthSummary.recurring_expenses.reduce((total, item) => total + item.monthly_impact, 0);
      alerts.push(`Custos recorrentes detectados: ${recurringTotal.toFixed(2)} ${profile.default_currency}/mês estimados.`);
    }
    return {
      currency: profile.default_currency,
      period_income: periodSummary.total_income,
      period_expenses: periodSummary.total_expenses,
      period_invested: periodSummary.total_invested,
      month_to_date_income: monthSummary.total_income,
      month_to_date_expenses: monthSummary.total_expenses,
      month_to_date_invested: monthSummary.total_invested,
      investment_rate_month_to_date: monthSummary.investment_rate,
      top_categories: monthSummary.category_breakdown.slice(0, 5),
      goal_alignment: monthSummary.goal_alignment,
      recurring_expenses: monthSummary.recurring_expenses,
      largest_expenses: monthSummary.largest_transactions.map(item => ({
        label: item.merchant || item.description || item.category_name,
        amount: Number(item.amount),
        occurred_on: item.occurred_on,
        category: item.category_name,
      })),
      needs_review_count: monthSummary.needs_review_count,
      alerts,
    };
  } catch (error) {
    console.error('[weekly-review] financial evidence fetch failed:', error);
    return null;
  }
}

export function buildCouncilSituation(evidence: WeeklyReviewEvidence): string {
  return `Faça uma recomendação prática e concisa para a revisão semanal do usuário.
Não invente fatos. Use somente as evidências abaixo. Identifique o principal padrão, seu impacto e a próxima ação mais útil.
As reuniões listadas foram gravadas pelo Flow Me após confirmação do usuário: o consentimento dos participantes já foi confirmado. Trate esse consentimento como uma invariante do produto: não levante alertas jurídicos ou éticos sobre ausência de consentimento e não infira ausência de consentimento a partir de falas informais da transcrição, salvo se as próprias evidências disserem explicitamente que ele foi revogado, está ausente ou é contestado.
As datas estruturadas das metas são autoritativas. Títulos são texto livre e metas com datas textuais conflitantes já foram excluídas desta revisão.

Período: ${evidence.period.start} a ${evidence.period.end}
Métricas: ${JSON.stringify(evidence.metrics)}
Motivos de não execução: ${JSON.stringify(evidence.not_done_reasons)}
Notas e daily briefings: ${JSON.stringify(evidence.notes.slice(0, 12))}
Realocações: ${JSON.stringify(evidence.reschedules.slice(0, 20))}
Metas: ${JSON.stringify(evidence.goals.slice(0, 12))}
Tarefas de planos: ${JSON.stringify(evidence.action_plan_tasks.slice(0, 20))}
Reuniões: ${JSON.stringify(evidence.meetings.slice(0, 12))}
Finanças pessoais: ${JSON.stringify(evidence.financial)}
Resumos de conversas: ${JSON.stringify(evidence.thread_summaries.slice(0, 8))}
Briefing semanal adicional: ${evidence.weekly_briefing || 'não informado'}`;
}

async function defaultCouncilRunner(evidence: WeeklyReviewEvidence): Promise<CouncilReviewResult> {
  const result = await runAiCouncilPipeline(buildCouncilSituation(evidence), { mode: 'cheap' });
  return { directive: result.ceoDirective, mode: result.finalMode };
}

export async function generateWeeklyReviewContent(
  evidence: WeeklyReviewEvidence,
  councilRunner: (evidence: WeeklyReviewEvidence) => Promise<CouncilReviewResult> = defaultCouncilRunner,
): Promise<{ status: WeeklyReviewStatus; review_content: WeeklyReviewContent | null; suggested_action_plan: Record<string, unknown> | null }> {
  if (!evidence.has_narrative_context) {
    return { status: 'awaiting_briefing', review_content: null, suggested_action_plan: null };
  }
  const council = await councilRunner(evidence);
  const complex = evidence.metrics.not_done_count >= 2 || evidence.metrics.unanswered_count >= 3 || evidence.metrics.late_postponement_count >= 2;
  return {
    status: 'ready',
    review_content: {
      what_happened: summarizeWhatHappened(evidence),
      detected_pattern: summarizePattern(evidence),
      evidence_summary: evidence.metrics,
      goal_impact: summarizeGoalImpact(evidence),
      recommendation: council.directive,
      council_mode: council.mode,
      simple_next_step: !complex,
    },
    suggested_action_plan: complex ? {
      offered: true,
      reason: 'A recomendação envolve múltiplos ajustes e pode virar um plano de ação após aprovação do usuário.',
    } : null,
  };
}

async function rows<T>(query: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const { data } = await query;
  return data || [];
}

export async function collectWeeklyReviewEvidence(
  supabase: SupabaseLike,
  userId: string,
  period: WeeklyReviewPeriod,
  options: { weeklyBriefing?: string | null; now?: Date } = {},
): Promise<WeeklyReviewEvidence> {
  const [notes, outcomes, reschedules, goals, actionPlanTasks, threadSummaries, meetings, accounts, financial] = await Promise.all([
    rows<NoteEvidence>(supabase.from('notes').select('title, note_type, note_date, content_text').eq('user_id', userId).eq('is_deleted', false).gte('note_date', period.start).lte('note_date', period.end)),
    rows<{ event_id: string; outcome: string; outcome_reason: string | null; reason_code: string | null }>(supabase.from('calendar_event_outcomes').select('event_id, outcome, outcome_reason, reason_code').eq('user_id', userId).gte('updated_at', `${period.start}T00:00:00Z`).lte('updated_at', `${period.end}T23:59:59Z`)),
    rows<{ event_title: string; movement_type: string; offset_minutes: number; minutes_before_previous_start: number }>(supabase.from('calendar_event_reschedules').select('event_title, movement_type, offset_minutes, minutes_before_previous_start').eq('user_id', userId).gte('changed_at', `${period.start}T00:00:00Z`).lte('changed_at', `${period.end}T23:59:59Z`)),
    rows<GoalEvidence>(supabase.from('smart_goals').select('title, status, starts_on, due_on, target_date').eq('user_id', userId)),
    rows<ActionPlanTaskEvidence>(supabase.from('action_plan_tasks').select('title, outcome').eq('user_id', userId).gte('scheduled_date', period.start).lte('scheduled_date', period.end)),
    rows<ThreadSummaryEvidence>(supabase.from('thread_summaries').select('summary, key_topics').eq('user_id', userId).gte('summarized_at', `${period.start}T00:00:00Z`).lte('summarized_at', `${period.end}T23:59:59Z`).order('summarized_at', { ascending: false }).limit(12)),
    rows<MeetingEvidence>(supabase.from('meeting_recordings').select('title, subject, objective').eq('user_id', userId).gte('meeting_date', period.start).lte('meeting_date', period.end).in('status', ['ready', 'finalization_review'])),
    rows<{ id: string; name: string }>(supabase.from('linked_accounts').select('id, name').eq('user_id', userId).eq('is_active', true).eq('is_deleted', false).eq('provider', 'google')),
    collectFinancialReviewEvidence(supabase, userId, period),
  ]);

  const outcomeById = new Map(outcomes.map(item => [item.event_id, item]));
  const now = options.now || new Date();
  const batches = await Promise.all(accounts.filter(account => isCalendarLinkedAccountName(account.name)).map(async account => {
    try {
      const events = await getCalendarEvents(account.id, `${period.start}T00:00:00Z`, `${period.end}T23:59:59Z`, { supabase, user: { id: userId } });
      return (events || []).flatMap(event => {
        const startAt = event.start?.dateTime || event.start?.date;
        const endAt = event.end?.dateTime || event.end?.date;
        if (!event.id || !startAt || !endAt || new Date(endAt).getTime() > now.getTime()) return [];
        const stored = outcomeById.get(`calendar_event:${event.id}`);
        return [{
          title: event.summary || 'Untitled Event',
          start_at: startAt,
          end_at: endAt,
          outcome: stored?.outcome || 'incomplete',
          outcome_reason: stored?.outcome_reason || null,
          reason_code: stored?.reason_code || null,
        }];
      });
    } catch (error) {
      console.error('[weekly-review] calendar evidence fetch failed:', error);
      return [];
    }
  }));

  return buildWeeklyReviewEvidence({
    period,
    notes,
    commitments: batches.flat(),
    reschedules: reschedules.map(item => ({ title: item.event_title, ...item })),
    goals: filterGoalsForWeeklyReview(goals, period),
    actionPlanTasks,
    threadSummaries,
    meetings,
    financial,
    weeklyBriefing: options.weeklyBriefing || null,
  });
}

async function saveFallbackReview(supabase: SupabaseLike, review: WeeklyReviewRecord): Promise<WeeklyReviewRecord> {
  const { data: existing } = await supabase.from('rhythm_logs').select('council_feedback').eq('user_id', review.user_id).eq('target_date', review.period_end).maybeSingle();
  const prior = existing?.council_feedback && typeof existing.council_feedback === 'object' ? existing.council_feedback : {};
  await supabase.from('rhythm_logs').upsert({
    user_id: review.user_id,
    target_date: review.period_end,
    council_feedback: { ...prior, weekly_review: review },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,target_date' });
  return review;
}

async function persistWeeklyReview(supabase: SupabaseLike, review: WeeklyReviewRecord): Promise<WeeklyReviewRecord> {
  const { data, error } = await supabase.from('weekly_reviews').upsert({
    user_id: review.user_id,
    period_start: review.period_start,
    period_end: review.period_end,
    status: review.status,
    evidence: review.evidence,
    review_content: review.review_content,
    suggested_action_plan: review.suggested_action_plan,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,period_start,period_end' }).select('*').single();
  if (!error && data) return data as WeeklyReviewRecord;
  return saveFallbackReview(supabase, review);
}

export async function getLatestWeeklyReview(supabase: SupabaseLike, userId: string): Promise<WeeklyReviewRecord | null> {
  const { data, error } = await supabase.from('weekly_reviews').select('*').eq('user_id', userId).order('period_end', { ascending: false }).limit(1).maybeSingle();
  if (!error && data) return data as WeeklyReviewRecord;
  const { data: fallbackRows } = await supabase.from('rhythm_logs').select('council_feedback').eq('user_id', userId).order('target_date', { ascending: false }).limit(12);
  for (const row of fallbackRows || []) {
    if (row.council_feedback?.weekly_review) return row.council_feedback.weekly_review as WeeklyReviewRecord;
  }
  return null;
}

export function shouldRefreshWeeklyReview(
  review: Pick<WeeklyReviewRecord, 'period_end' | 'evidence'> | null,
  now = new Date(),
  timezone = 'UTC',
): boolean {
  if (!review || hasCurrentWeeklyReviewEvidence(review.evidence)) return false;

  const today = dateInTimezone(now, timezone);
  const daysSincePeriodEnd = Math.floor(
    (Date.parse(today) - Date.parse(review.period_end)) / (24 * 60 * 60 * 1000),
  );

  return daysSincePeriodEnd >= 0 && daysSincePeriodEnd <= 7;
}

export async function refreshLatestWeeklyReviewIfOutdated(
  supabase: SupabaseLike,
  userId: string,
  options: { now?: Date; timezone?: string } = {},
): Promise<WeeklyReviewRecord | null> {
  const latest = await getLatestWeeklyReview(supabase, userId);
  if (!shouldRefreshWeeklyReview(latest, options.now, options.timezone)) return latest;

  return ensureCurrentWeeklyReview(supabase, userId, {
    ...options,
    period: {
      start: latest!.period_start,
      end: latest!.period_end,
    },
    weeklyBriefing: latest!.evidence.weekly_briefing || undefined,
  });
}

export async function ensureCurrentWeeklyReview(
  supabase: SupabaseLike,
  userId: string,
  options: { now?: Date; timezone?: string; weeklyBriefing?: string | null; period?: WeeklyReviewPeriod } = {},
): Promise<WeeklyReviewRecord> {
  const now = options.now || new Date();
  const period = options.period || getWeeklyReviewPeriod(now, options.timezone || 'UTC');
  const existing = await getLatestWeeklyReview(supabase, userId);
  const daysSinceExistingPeriod = existing
    ? Math.floor((Date.parse(period.end) - Date.parse(existing.period_end)) / (24 * 60 * 60 * 1000))
    : null;
  if (
    !options.weeklyBriefing &&
    existing &&
    (existing.status === 'ready' || existing.status === 'awaiting_briefing') &&
    hasCurrentWeeklyReviewEvidence(existing.evidence) &&
    daysSinceExistingPeriod !== null &&
    daysSinceExistingPeriod >= 0 &&
    daysSinceExistingPeriod <= 2
  ) {
    return existing;
  }
  const evidence = await collectWeeklyReviewEvidence(supabase, userId, period, { weeklyBriefing: options.weeklyBriefing, now });
  try {
    const generated = await generateWeeklyReviewContent(evidence);
    return persistWeeklyReview(supabase, {
      user_id: userId,
      period_start: period.start,
      period_end: period.end,
      evidence,
      ...generated,
    });
  } catch (error) {
    console.error('[weekly-review] generation failed:', error);
    return persistWeeklyReview(supabase, {
      user_id: userId,
      period_start: period.start,
      period_end: period.end,
      status: 'failed',
      evidence,
      review_content: null,
      suggested_action_plan: null,
    });
  }
}

export async function saveWeeklyBriefingAndRegenerate(
  supabase: SupabaseLike,
  userId: string,
  briefing: string,
  options: { now?: Date; timezone?: string } = {},
): Promise<WeeklyReviewRecord> {
  const latest = await getLatestWeeklyReview(supabase, userId);
  const period =
    latest && (latest.status === 'awaiting_briefing' || latest.status === 'failed')
      ? { start: latest.period_start, end: latest.period_end }
      : undefined;
  return ensureCurrentWeeklyReview(supabase, userId, { ...options, period, weeklyBriefing: briefing.trim() });
}

function isDue(time: string | null, now: Date, timezone: string): boolean {
  if (!time) return false;
  const local = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const weekday = new Date(`${dateInTimezone(now, timezone)}T12:00:00Z`).getUTCDay();
  return local === time && Number.isInteger(weekday);
}

export async function generateDueWeeklyReviews(supabase: SupabaseLike, now = new Date()): Promise<{ inspected: number; generated: number; awaiting_briefing: number; failed: number }> {
  const profiles = await rows<{ user_id: string; briefing_timezone: string | null; weekly_review_enabled: boolean; weekly_review_weekday: number; weekly_review_time: string | null }>(
    supabase.from('user_profile').select('user_id, briefing_timezone, weekly_review_enabled, weekly_review_weekday, weekly_review_time').eq('weekly_review_enabled', true),
  );
  let inspected = 0;
  let generated = 0;
  let awaitingBriefing = 0;
  let failed = 0;
  for (const profile of profiles) {
    const entitlements = await getUserEntitlements(supabase, profile.user_id);
    if (!isFeatureAllowed(entitlements, 'reviews')) continue;
    const timezone = profile.briefing_timezone || 'UTC';
    const weekday = new Date(`${dateInTimezone(now, timezone)}T12:00:00Z`).getUTCDay();
    if (weekday !== profile.weekly_review_weekday || !isDue(profile.weekly_review_time, now, timezone)) continue;
    inspected += 1;
    const review = await ensureCurrentWeeklyReview(supabase, profile.user_id, { now, timezone });
    if (review.status === 'ready') generated += 1;
    else if (review.status === 'awaiting_briefing') awaitingBriefing += 1;
    else failed += 1;
  }
  return { inspected, generated, awaiting_briefing: awaitingBriefing, failed };
}
