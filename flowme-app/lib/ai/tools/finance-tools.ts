import { z } from 'zod';
import { defineTool } from './Tool';
import { createFinancialTransaction, getFinanceHealthTrend, getFinanceMonthlySummary, getFinancePeriodSummary, getFinancialProfile, listFinancialTransactions, updateFinancialTransaction } from '@/lib/finance/finance';
import { parseFinancialTransaction } from '@/lib/finance/parse-transaction';
import { formatFinanceAmount, normalizeFinanceCurrency } from '@/lib/finance/currency';
import { FINANCE_TRANSACTION_TYPES } from '@/lib/finance/types';

function visibleTransaction(item: any) {
  return {
    label: item.merchant || item.description || item.category_name,
    type: item.type,
    amount: formatFinanceAmount(Number(item.amount), item.currency),
    occurred_on: item.occurred_on,
    category: item.category_name,
    status: item.status,
  };
}

function currentMonth(nowIso: string): string {
  return nowIso.slice(0, 7);
}

function localDate(nowIso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(nowIso));
  const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export const financeRecordTransactionTool = defineTool({
  name: 'finance.record_transaction',
  description: `Records a personal financial transaction from natural language.

WHEN TO USE: the user says they spent, received, paid, invested, bought, or wants to log an expense/income/investment.

CONTRACT:
- Use raw_text for the user's original sentence whenever possible.
- If amount is missing, do not invent it; return needs_follow_up.
- Use the user's default currency when omitted.
- Confirm in one short, natural sentence.
- Never expose transaction IDs.`,
  isReadOnly: false,
  inputSchema: z.object({
    raw_text: z.string().min(1).max(1000),
    type: z.enum(FINANCE_TRANSACTION_TYPES).optional(),
    amount: z.number().positive().optional(),
    currency: z.string().optional(),
    occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    category_name: z.string().optional(),
    merchant: z.string().optional(),
    description: z.string().optional(),
    payment_method: z.string().optional(),
  }),
  call: async (args, context) => {
    const profile = await getFinancialProfile(context.supabase, context.user.id);
    const parsed = parseFinancialTransaction(args.raw_text, {
      defaultCurrency: profile.default_currency,
      now: new Date(context.nowIso),
      timezone: context.timezone,
    });
    const amount = args.amount ?? parsed.amount;
    if (!amount) {
      return { ok: true, receipt: { needs_follow_up: true, prompt: 'Qual foi o valor?' } };
    }
    const currency = normalizeFinanceCurrency(args.currency || parsed.currency, profile.default_currency);
    const transaction = await createFinancialTransaction(context.supabase, context.user.id, {
      type: args.type || parsed.type,
      amount,
      currency,
      occurred_on: args.occurred_on || parsed.occurred_on,
      category_name: args.category_name || parsed.category_name,
      merchant: args.merchant || parsed.merchant,
      description: args.description || parsed.description,
      payment_method: args.payment_method,
      source: 'balys',
      raw_text: args.raw_text,
      confidence: parsed.confidence,
      status: parsed.needs_review ? 'needs_review' : 'confirmed',
    });
    return { ok: true, receipt: { recorded: true, transaction: visibleTransaction(transaction) } };
  },
});

export const financeGetMonthSummaryTool = defineTool({
  name: 'finance.get_month_summary',
  description: `Reads deterministic monthly finance totals and category breakdown.

WHEN TO USE: the user asks how much they spent, invested, received, their balance, spending by category, or financial health for a month.

RETURNS human-readable totals only. Never expose IDs.`,
  isReadOnly: true,
  inputSchema: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  }),
  call: async (args, context) => {
    const summary = await getFinanceMonthlySummary(context.supabase, context.user.id, args.month || currentMonth(context.nowIso));
    return {
      ok: true,
      receipt: {
        month: summary.month,
        currency: summary.currency,
        total_income: formatFinanceAmount(summary.total_income, summary.currency),
        total_expenses: formatFinanceAmount(summary.total_expenses, summary.currency),
        total_invested: formatFinanceAmount(summary.total_invested, summary.currency),
        net_balance: formatFinanceAmount(summary.net_balance, summary.currency),
        investment_rate: summary.investment_rate,
        categories: summary.category_breakdown.map(item => ({
          category: item.category,
          amount: formatFinanceAmount(item.amount, summary.currency),
          share: item.share,
        })),
        goal_alignment: summary.goal_alignment.map(item => ({
          goal: item.goal_title,
          monthly_target: formatFinanceAmount(item.monthly_target, item.currency),
          actual_saved: formatFinanceAmount(item.actual_saved, item.currency),
          gap: formatFinanceAmount(item.gap, item.currency),
          adherence: item.adherence,
          status: item.status,
        })),
        needs_review_count: summary.needs_review_count,
      },
    };
  },
});

export const financeListTransactionsTool = defineTool({
  name: 'finance.list_transactions',
  description: `Lists financial transactions for human-facing lookup, corrections, deletion, or explicit itemized questions.

WHEN TO USE: the user asks "quais foram os gastos deste mês?", "lista todos os gastos", "gastos de hoje", or needs a one-by-one transaction list.

Never expose IDs.`,
  isReadOnly: true,
  inputSchema: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    limit: z.number().min(1).max(50).optional(),
  }),
  call: async (args, context) => {
    const transactions = await listFinancialTransactions(context.supabase, context.user.id, {
      month: args.month,
      start: args.start,
      end: args.end,
      limit: args.limit || 50,
    });
    return { ok: true, receipt: { count: transactions.length, transactions: transactions.map(visibleTransaction) } };
  },
});

export const financeGetPeriodSummaryTool = defineTool({
  name: 'finance.get_period_summary',
  description: `Reads deterministic finance totals for an exact date range.

WHEN TO USE: the user asks "quanto gastei hoje?", "quanto gastei do dia X ao dia Y?", "quanto investi nessa semana?", or any date-range finance question.

Use start=end=today for "hoje". Never invent totals.`,
  isReadOnly: true,
  inputSchema: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  call: async (args, context) => {
    const today = localDate(context.nowIso, context.timezone);
    const start = args.start || today;
    const end = args.end || start;
    const summary = await getFinancePeriodSummary(context.supabase, context.user.id, { start, end });
    return {
      ok: true,
      receipt: {
        period: summary.period,
        total_income: formatFinanceAmount(summary.total_income, summary.currency),
        total_expenses: formatFinanceAmount(summary.total_expenses, summary.currency),
        total_invested: formatFinanceAmount(summary.total_invested, summary.currency),
        net_balance: formatFinanceAmount(summary.net_balance, summary.currency),
        transaction_count: summary.transaction_count,
        categories: summary.category_breakdown.map(item => ({
          category: item.category,
          amount: formatFinanceAmount(item.amount, summary.currency),
          share: item.share,
        })),
        goal_alignment: summary.goal_alignment.map(item => ({
          goal: item.goal_title,
          monthly_target: formatFinanceAmount(item.monthly_target, item.currency),
          actual_saved: formatFinanceAmount(item.actual_saved, item.currency),
          gap: formatFinanceAmount(item.gap, item.currency),
          adherence: item.adherence,
          status: item.status,
        })),
      },
    };
  },
});

export const financeAnalyzeHealthTool = defineTool({
  name: 'finance.analyze_health',
  description: `Reads deterministic finance evidence for personal financial health advice.

WHEN TO USE: the user asks "como está minha saúde financeira?", "o que devo cortar?", "onde posso economizar?", or asks for cost-cutting advice.

Returns evidence only; Balys should explain naturally without inventing totals.`,
  isReadOnly: true,
  inputSchema: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  }),
  call: async (args, context) => {
    const summary = await getFinanceMonthlySummary(context.supabase, context.user.id, args.month || currentMonth(context.nowIso));
    const topCategories = summary.category_breakdown.slice(0, 5);
    const cutCandidates = topCategories.filter(item => !['moradia', 'impostos', 'dívidas'].includes(item.category)).slice(0, 3);
    return {
      ok: true,
      receipt: {
        month: summary.month,
        total_income: formatFinanceAmount(summary.total_income, summary.currency),
        total_expenses: formatFinanceAmount(summary.total_expenses, summary.currency),
        total_invested: formatFinanceAmount(summary.total_invested, summary.currency),
        net_balance: formatFinanceAmount(summary.net_balance, summary.currency),
        investment_rate: summary.investment_rate,
        top_categories: topCategories.map(item => ({ category: item.category, amount: formatFinanceAmount(item.amount, summary.currency), share: item.share })),
        cut_candidates: cutCandidates.map(item => ({ category: item.category, amount: formatFinanceAmount(item.amount, summary.currency), share: item.share })),
        goal_alignment: summary.goal_alignment.map(item => ({
          goal: item.goal_title,
          monthly_target: formatFinanceAmount(item.monthly_target, item.currency),
          actual_saved: formatFinanceAmount(item.actual_saved, item.currency),
          gap: formatFinanceAmount(item.gap, item.currency),
          adherence: item.adherence,
          status: item.status,
        })),
        warnings: [
          ...(summary.total_income <= 0 && summary.total_expenses > 0 ? ['income_missing'] : []),
          ...(summary.needs_review_count > 0 ? ['transactions_need_review'] : []),
        ],
      },
    };
  },
});

export const financeGetHealthTrendTool = defineTool({
  name: 'finance.get_health_trend',
  description: `Reads deterministic month-by-month financial health evolution.

WHEN TO USE: the user asks "qual a evolução da minha saúde financeira nos últimos meses?", "como meus gastos evoluíram?", or asks for trends over recent months.`,
  isReadOnly: true,
  inputSchema: z.object({
    months: z.number().min(2).max(24).optional(),
    end_month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  }),
  call: async (args, context) => {
    const trend = await getFinanceHealthTrend(context.supabase, context.user.id, {
      months: args.months || 6,
      endMonth: args.end_month || currentMonth(context.nowIso),
    });
    return {
      ok: true,
      receipt: {
        months: trend.map(item => ({
          month: item.month,
          total_income: item.total_income,
          total_expenses: item.total_expenses,
          total_invested: item.total_invested,
          net_balance: item.net_balance,
          investment_rate: item.investment_rate,
          goal_alignment: item.goal_alignment.map(goal => ({
            goal: goal.goal_title,
            adherence: goal.adherence,
            status: goal.status,
            gap: formatFinanceAmount(goal.gap, goal.currency),
          })),
        })),
      },
    };
  },
});

export const financeUpdateLatestTransactionTool = defineTool({
  name: 'finance.update_latest_transaction',
  description: `Updates the user's most recent matching financial transaction after a correction.

WHEN TO USE: "esse Uber foi trabalho", "foi ontem", "o valor certo era 89".
- Resolve by recent human-facing context. If unsure, list transactions first and ask by visible details.
- Never expose IDs.`,
  isReadOnly: false,
  inputSchema: z.object({
    search_text: z.string().optional(),
    category_name: z.string().optional(),
    amount: z.number().positive().optional(),
    occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    status: z.enum(['confirmed', 'needs_review', 'ignored']).optional(),
  }),
  call: async (args, context) => {
    const transactions = await listFinancialTransactions(context.supabase, context.user.id, { limit: 20 });
    const needle = args.search_text?.trim().toLowerCase();
    const match = needle
      ? transactions.find(item => [item.merchant, item.description, item.category_name].filter(Boolean).join(' ').toLowerCase().includes(needle))
      : transactions[0];
    if (!match) return { ok: true, receipt: { needs_follow_up: true, prompt: 'Qual gasto você quer ajustar?' } };
    const transaction = await updateFinancialTransaction(context.supabase, context.user.id, match.id, {
      ...(args.category_name ? { category_name: args.category_name } : {}),
      ...(args.amount ? { amount: args.amount } : {}),
      ...(args.occurred_on ? { occurred_on: args.occurred_on } : {}),
      ...(args.status ? { status: args.status } : {}),
    });
    return { ok: true, receipt: { updated: true, transaction: visibleTransaction(transaction) } };
  },
});

export const FINANCE_TOOLS = [
  financeRecordTransactionTool,
  financeGetMonthSummaryTool,
  financeListTransactionsTool,
  financeGetPeriodSummaryTool,
  financeAnalyzeHealthTool,
  financeGetHealthTrendTool,
  financeUpdateLatestTransactionTool,
];
