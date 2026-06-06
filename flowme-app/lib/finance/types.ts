export const FINANCE_CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP', 'ARS', 'MXN'] as const;
export const FINANCE_TRANSACTION_TYPES = ['expense', 'income', 'investment', 'transfer'] as const;
export const FINANCE_TRANSACTION_STATUSES = ['confirmed', 'needs_review', 'ignored'] as const;
export const FINANCE_TRANSACTION_SOURCES = ['web', 'balys', 'whatsapp', 'api', 'import'] as const;

export type FinanceCurrency = typeof FINANCE_CURRENCIES[number];
export type FinanceTransactionType = typeof FINANCE_TRANSACTION_TYPES[number];
export type FinanceTransactionStatus = typeof FINANCE_TRANSACTION_STATUSES[number];
export type FinanceTransactionSource = typeof FINANCE_TRANSACTION_SOURCES[number];

export interface FinancialProfile {
  user_id: string;
  default_currency: FinanceCurrency;
  monthly_income_target: number | null;
  monthly_investment_target: number | null;
  emergency_reserve_target: number | null;
  main_financial_objective: string | null;
  risk_profile: string | null;
}

export interface FinancialTransaction {
  id: string;
  user_id: string;
  type: FinanceTransactionType;
  amount: number;
  currency: FinanceCurrency;
  converted_amount: number | null;
  converted_currency: FinanceCurrency | null;
  exchange_rate: number | null;
  occurred_on: string;
  category_id: string | null;
  category_name: string;
  merchant: string | null;
  description: string | null;
  payment_method: string | null;
  source: FinanceTransactionSource;
  raw_text: string | null;
  confidence: number | null;
  status: FinanceTransactionStatus;
  created_at?: string;
  updated_at?: string;
}

export interface FinanceSummaryCategory {
  category: string;
  amount: number;
  share: number;
}

export interface FinanceMonthlySummary {
  month: string;
  currency: FinanceCurrency;
  total_income: number;
  total_expenses: number;
  total_invested: number;
  net_balance: number;
  investment_rate: number | null;
  category_breakdown: FinanceSummaryCategory[];
  largest_transactions: Array<Pick<FinancialTransaction, 'id' | 'amount' | 'currency' | 'occurred_on' | 'category_name' | 'merchant' | 'description'>>;
  recent_transactions: FinancialTransaction[];
  needs_review_count: number;
  goal_alignment: FinancialGoalAlignment[];
  recurring_expenses: FinanceRecurringExpense[];
  previous_month?: {
    total_expenses: number;
    delta_expenses: number;
  };
}

export interface FinancePeriodSummary extends Omit<FinanceMonthlySummary, 'month' | 'previous_month'> {
  period: { start: string; end: string };
  transaction_count: number;
}

export interface FinanceHealthTrendPoint {
  month: string;
  total_income: number;
  total_expenses: number;
  total_invested: number;
  net_balance: number;
  investment_rate: number | null;
  goal_alignment: FinancialGoalAlignment[];
}

export interface FinanceRecurringExpense {
  label: string;
  category: string;
  currency: FinanceCurrency;
  average_amount: number;
  latest_amount: number;
  monthly_impact: number;
  occurrences: number;
  months_seen: string[];
  last_seen: string;
  frequency: 'monthly';
  confidence: number;
  status: 'active' | 'possible';
}

export interface FinancialGoalAlignment {
  goal_title: string;
  target_period: 'monthly' | 'annual';
  target_amount: number;
  monthly_target: number;
  actual_saved: number;
  gap: number;
  adherence: number;
  currency: FinanceCurrency;
  basis: 'structured_goal' | 'parsed_goal_text';
  status: 'on_track' | 'behind' | 'ahead';
}
