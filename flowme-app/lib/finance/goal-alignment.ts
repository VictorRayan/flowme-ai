import type { FinanceCurrency, FinancialGoalAlignment, FinanceMonthlySummary } from './types';

export interface FinanceGoalCandidate {
  title: string;
  timeframe: string;
  status: string;
  objective_metric?: string | null;
  target_value?: number | null;
  unit?: string | null;
  starts_on?: string | null;
  due_on?: string | null;
  target_date?: string | null;
  success_criteria?: string | null;
}

interface ParsedGoalTarget {
  target_amount: number;
  target_period: 'monthly' | 'annual';
  basis: 'structured_goal' | 'parsed_goal_text';
}

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '').replace(/r\$/i, '');
  const suffix = cleaned.match(/[kKmM]$/)?.[0].toLowerCase();
  const numeric = cleaned.replace(/[kKmM]$/, '');
  const normalized = numeric.includes(',')
    ? numeric.replace(/\./g, '').replace(',', '.')
    : /\.\d{3}$/.test(numeric) ? numeric.replace(/\./g, '') : numeric;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (suffix === 'k') return value * 1000;
  if (suffix === 'm') return value * 1000000;
  return value;
}

function isFinancialSavingsGoal(goal: FinanceGoalCandidate): boolean {
  const text = normalizeText([goal.title, goal.success_criteria, goal.objective_metric, goal.unit].filter(Boolean).join(' '));
  return /\b(poupar|guardar|economizar|investir|juntar|reserva|save|saving|savings|invest)\b/.test(text);
}

function structuredTarget(goal: FinanceGoalCandidate): ParsedGoalTarget | null {
  if (!goal.target_value || goal.target_value <= 0 || !isFinancialSavingsGoal(goal)) return null;
  const targetPeriod = goal.timeframe === 'monthly' ? 'monthly' : 'annual';
  return {
    target_amount: Number(goal.target_value),
    target_period: targetPeriod,
    basis: 'structured_goal',
  };
}

function parsedTextTarget(goal: FinanceGoalCandidate): ParsedGoalTarget | null {
  if (!isFinancialSavingsGoal(goal)) return null;
  const text = normalizeText([goal.title, goal.success_criteria].filter(Boolean).join(' '));
  const amountMatch = text.match(/(?:r\$\s*)?(\d+(?:[.,]\d+)?\s*[kKmM]?|\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?)/);
  if (!amountMatch) return null;
  const amount = parseAmount(amountMatch[1]);
  if (!amount) return null;
  const monthly = /\b(mes|mensal|monthly|per month)\b/.test(text) || goal.timeframe === 'monthly';
  const annual = /\b(ano|anual|year|annual|yearly)\b/.test(text) || goal.timeframe === 'yearly';
  return {
    target_amount: amount,
    target_period: monthly && !annual ? 'monthly' : 'annual',
    basis: 'parsed_goal_text',
  };
}

export function extractFinancialGoalTarget(goal: FinanceGoalCandidate): ParsedGoalTarget | null {
  return structuredTarget(goal) || parsedTextTarget(goal);
}

export function buildFinancialGoalAlignment(
  goals: FinanceGoalCandidate[],
  summary: Pick<FinanceMonthlySummary, 'currency' | 'total_invested' | 'net_balance'>,
): FinancialGoalAlignment[] {
  const actualSaved = Math.round((summary.total_invested + Math.max(summary.net_balance, 0)) * 100) / 100;
  const alignments: FinancialGoalAlignment[] = [];
  for (const goal of goals) {
    if (goal.status === 'completed' || goal.status === 'cancelled') continue;
    const target = extractFinancialGoalTarget(goal);
    if (!target) continue;
    const monthlyTarget = target.target_period === 'monthly' ? target.target_amount : target.target_amount / 12;
    const roundedMonthlyTarget = Math.round(monthlyTarget * 100) / 100;
    const gap = Math.round((actualSaved - roundedMonthlyTarget) * 100) / 100;
    const adherence = roundedMonthlyTarget > 0 ? Math.round((actualSaved / roundedMonthlyTarget) * 10000) / 10000 : 0;
    alignments.push({
      goal_title: goal.title,
      target_period: target.target_period,
      target_amount: Math.round(target.target_amount * 100) / 100,
      monthly_target: roundedMonthlyTarget,
      actual_saved: actualSaved,
      gap,
      adherence,
      currency: summary.currency as FinanceCurrency,
      basis: target.basis,
      status: gap >= 0 ? 'on_track' : 'behind',
    });
  }
  return alignments;
}
