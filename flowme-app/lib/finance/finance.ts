import { normalizeFinanceCurrency } from './currency';
import { buildFinancialGoalAlignment, type FinanceGoalCandidate } from './goal-alignment';
import type { FinanceCurrency, FinanceHealthTrendPoint, FinanceMonthlySummary, FinancePeriodSummary, FinancialProfile, FinancialTransaction, FinanceTransactionSource, FinanceTransactionStatus, FinanceTransactionType } from './types';

type SupabaseLike = { from(table: string): any };

const DEFAULT_CURRENCY: FinanceCurrency = 'BRL';

export async function getFinancialProfile(supabase: SupabaseLike, userId: string): Promise<FinancialProfile> {
  const { data } = await supabase
    .from('financial_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (data?.default_currency) return { ...data, default_currency: normalizeFinanceCurrency(data.default_currency) } as FinancialProfile;

  const profile = {
    user_id: userId,
    default_currency: DEFAULT_CURRENCY,
    monthly_income_target: null,
    monthly_investment_target: null,
    emergency_reserve_target: null,
    main_financial_objective: null,
    risk_profile: null,
  };
  const { data: inserted } = await supabase
    .from('financial_profiles')
    .upsert({ ...profile, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select('*')
    .single();
  return (inserted || profile) as FinancialProfile;
}

export async function upsertFinancialProfile(
  supabase: SupabaseLike,
  userId: string,
  patch: Partial<Omit<FinancialProfile, 'user_id'>>,
): Promise<FinancialProfile> {
  const row = {
    user_id: userId,
    ...patch,
    ...(patch.default_currency ? { default_currency: normalizeFinanceCurrency(patch.default_currency) } : {}),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('financial_profiles')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw new Error(error.message || 'Failed to save financial profile');
  return data as FinancialProfile;
}

export interface CreateTransactionInput {
  type: FinanceTransactionType;
  amount: number;
  currency: FinanceCurrency;
  occurred_on: string;
  category_name?: string;
  merchant?: string | null;
  description?: string | null;
  payment_method?: string | null;
  source?: FinanceTransactionSource;
  raw_text?: string | null;
  confidence?: number | null;
  status?: FinanceTransactionStatus;
}

export async function createFinancialTransaction(
  supabase: SupabaseLike,
  userId: string,
  input: CreateTransactionInput,
): Promise<FinancialTransaction> {
  const row = {
    user_id: userId,
    type: input.type,
    amount: input.amount,
    currency: normalizeFinanceCurrency(input.currency),
    occurred_on: input.occurred_on,
    category_name: input.category_name?.trim() || 'outros',
    merchant: input.merchant?.trim() || null,
    description: input.description?.trim() || null,
    payment_method: input.payment_method?.trim() || null,
    source: input.source || 'web',
    raw_text: input.raw_text?.trim() || null,
    confidence: input.confidence ?? null,
    status: input.status || 'confirmed',
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('financial_transactions').insert(row).select('*').single();
  if (error) throw new Error(error.message || 'Failed to create financial transaction');
  return data as FinancialTransaction;
}

export interface ListTransactionsFilters {
  month?: string;
  type?: FinanceTransactionType;
  category?: string;
  status?: FinanceTransactionStatus;
  start?: string;
  end?: string;
  limit?: number;
}

function monthRange(month: string): { start: string; end: string } {
  const start = `${month}-01`;
  const parsed = new Date(`${start}T12:00:00.000Z`);
  parsed.setUTCMonth(parsed.getUTCMonth() + 1);
  parsed.setUTCDate(0);
  return { start, end: parsed.toISOString().slice(0, 10) };
}

export async function listFinancialTransactions(
  supabase: SupabaseLike,
  userId: string,
  filters: ListTransactionsFilters = {},
): Promise<FinancialTransaction[]> {
  let query = supabase
    .from('financial_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(filters.limit || 100);

  const range = filters.month ? monthRange(filters.month) : null;
  if (range) query = query.gte('occurred_on', range.start).lte('occurred_on', range.end);
  if (filters.start) query = query.gte('occurred_on', filters.start);
  if (filters.end) query = query.lte('occurred_on', filters.end);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.category) query = query.ilike('category_name', filters.category);

  const { data, error } = await query;
  if (error) throw new Error(error.message || 'Failed to list financial transactions');
  return (data || []) as FinancialTransaction[];
}

export async function updateFinancialTransaction(
  supabase: SupabaseLike,
  userId: string,
  id: string,
  patch: Partial<CreateTransactionInput>,
): Promise<FinancialTransaction> {
  const { data, error } = await supabase
    .from('financial_transactions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message || 'Failed to update financial transaction');
  return data as FinancialTransaction;
}

export async function deleteFinancialTransaction(supabase: SupabaseLike, userId: string, id: string): Promise<void> {
  const { error } = await supabase.from('financial_transactions').delete().eq('user_id', userId).eq('id', id);
  if (error) throw new Error(error.message || 'Failed to delete financial transaction');
}

function sumByType(transactions: FinancialTransaction[], type: FinanceTransactionType): number {
  return Math.round(transactions
    .filter(item => item.type === type && item.status === 'confirmed')
    .reduce((total, item) => total + Number(item.converted_amount ?? item.amount), 0) * 100) / 100;
}

export function buildFinanceSummary(
  transactions: FinancialTransaction[],
  input: { month: string; currency: FinanceCurrency; previousMonthTransactions?: FinancialTransaction[]; goals?: FinanceGoalCandidate[] },
): FinanceMonthlySummary {
  const confirmedExpenses = transactions.filter(item => item.type === 'expense' && item.status === 'confirmed');
  const totalIncome = sumByType(transactions, 'income');
  const totalExpenses = sumByType(transactions, 'expense');
  const totalInvested = sumByType(transactions, 'investment');
  const byCategory = new Map<string, number>();
  for (const item of confirmedExpenses) {
    byCategory.set(item.category_name, (byCategory.get(item.category_name) || 0) + Number(item.converted_amount ?? item.amount));
  }
  const categoryBreakdown = Array.from(byCategory.entries())
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      share: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 10000) / 10000 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
  const previousTotal = input.previousMonthTransactions ? sumByType(input.previousMonthTransactions, 'expense') : 0;

  return {
    month: input.month,
    currency: input.currency,
    total_income: totalIncome,
    total_expenses: totalExpenses,
    total_invested: totalInvested,
    net_balance: Math.round((totalIncome - totalExpenses - totalInvested) * 100) / 100,
    investment_rate: totalIncome > 0 ? Math.round((totalInvested / totalIncome) * 10000) / 10000 : null,
    category_breakdown: categoryBreakdown,
    largest_transactions: confirmedExpenses
      .slice()
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5)
      .map(item => ({
        id: item.id,
        amount: Number(item.amount),
        currency: item.currency,
        occurred_on: item.occurred_on,
        category_name: item.category_name,
        merchant: item.merchant,
        description: item.description,
      })),
    recent_transactions: transactions.slice(0, 12),
    needs_review_count: transactions.filter(item => item.status === 'needs_review').length,
    goal_alignment: buildFinancialGoalAlignment(input.goals || [], {
      currency: input.currency,
      total_invested: totalInvested,
      net_balance: Math.round((totalIncome - totalExpenses - totalInvested) * 100) / 100,
    }),
    previous_month: input.previousMonthTransactions ? {
      total_expenses: previousTotal,
      delta_expenses: Math.round((totalExpenses - previousTotal) * 100) / 100,
    } : undefined,
  };
}

export function buildFinancePeriodSummary(
  transactions: FinancialTransaction[],
  input: { start: string; end: string; currency: FinanceCurrency; goals?: FinanceGoalCandidate[] },
): FinancePeriodSummary {
  const summary = buildFinanceSummary(transactions, {
    month: input.start.slice(0, 7),
    currency: input.currency,
    goals: input.goals,
  });
  return {
    period: { start: input.start, end: input.end },
    currency: summary.currency,
    total_income: summary.total_income,
    total_expenses: summary.total_expenses,
    total_invested: summary.total_invested,
    net_balance: summary.net_balance,
    investment_rate: summary.investment_rate,
    category_breakdown: summary.category_breakdown,
    largest_transactions: summary.largest_transactions,
    recent_transactions: summary.recent_transactions,
    needs_review_count: summary.needs_review_count,
    goal_alignment: summary.goal_alignment,
    transaction_count: transactions.filter(item => item.status === 'confirmed').length,
  };
}

async function listActiveFinanceGoals(supabase: SupabaseLike, userId: string): Promise<FinanceGoalCandidate[]> {
  const { data, error } = await supabase
    .from('smart_goals')
    .select('title, timeframe, status, objective_metric, target_value, unit, starts_on, due_on, target_date, success_criteria')
    .eq('user_id', userId)
    .in('status', ['not_started', 'in_progress']);
  if (error) throw new Error(error.message || 'Failed to list finance goals');
  return (data || []) as FinanceGoalCandidate[];
}

export async function getFinanceMonthlySummary(
  supabase: SupabaseLike,
  userId: string,
  month: string,
): Promise<FinanceMonthlySummary> {
  const profile = await getFinancialProfile(supabase, userId);
  const current = await listFinancialTransactions(supabase, userId, { month, limit: 500 });
  const prevDate = new Date(`${month}-01T12:00:00.000Z`);
  prevDate.setUTCMonth(prevDate.getUTCMonth() - 1);
  const previousMonth = prevDate.toISOString().slice(0, 7);
  const [previous, goals] = await Promise.all([
    listFinancialTransactions(supabase, userId, { month: previousMonth, limit: 500 }),
    listActiveFinanceGoals(supabase, userId),
  ]);
  return buildFinanceSummary(current, {
    month,
    currency: profile.default_currency,
    previousMonthTransactions: previous,
    goals,
  });
}

export async function getFinancePeriodSummary(
  supabase: SupabaseLike,
  userId: string,
  period: { start: string; end: string },
): Promise<FinancePeriodSummary> {
  const [profile, goals, transactions] = await Promise.all([
    getFinancialProfile(supabase, userId),
    listActiveFinanceGoals(supabase, userId),
    listFinancialTransactions(supabase, userId, { start: period.start, end: period.end, limit: 1000 }),
  ]);
  return buildFinancePeriodSummary(transactions, {
    start: period.start,
    end: period.end,
    currency: profile.default_currency,
    goals,
  });
}

function addMonths(month: string, amount: number): string {
  const date = new Date(`${month}-01T12:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}

export async function getFinanceHealthTrend(
  supabase: SupabaseLike,
  userId: string,
  input: { endMonth: string; months: number },
): Promise<FinanceHealthTrendPoint[]> {
  const months = Math.max(1, Math.min(24, Math.round(input.months)));
  const startMonth = addMonths(input.endMonth, -(months - 1));
  const start = `${startMonth}-01`;
  const endDate = new Date(`${input.endMonth}-01T12:00:00.000Z`);
  endDate.setUTCMonth(endDate.getUTCMonth() + 1);
  endDate.setUTCDate(0);
  const end = endDate.toISOString().slice(0, 10);
  const [profile, goals, transactions] = await Promise.all([
    getFinancialProfile(supabase, userId),
    listActiveFinanceGoals(supabase, userId),
    listFinancialTransactions(supabase, userId, { start, end, limit: 5000 }),
  ]);
  const points: FinanceHealthTrendPoint[] = [];
  for (let i = 0; i < months; i += 1) {
    const month = addMonths(startMonth, i);
    const monthTransactions = transactions.filter(item => item.occurred_on.startsWith(month));
    const summary = buildFinanceSummary(monthTransactions, { month, currency: profile.default_currency, goals });
    points.push({
      month,
      total_income: summary.total_income,
      total_expenses: summary.total_expenses,
      total_invested: summary.total_invested,
      net_balance: summary.net_balance,
      investment_rate: summary.investment_rate,
      goal_alignment: summary.goal_alignment,
    });
  }
  return points;
}
