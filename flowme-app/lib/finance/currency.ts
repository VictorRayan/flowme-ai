import { FINANCE_CURRENCIES, type FinanceCurrency } from './types';

export function isFinanceCurrency(value: unknown): value is FinanceCurrency {
  return typeof value === 'string' && FINANCE_CURRENCIES.includes(value.toUpperCase() as FinanceCurrency);
}

export function normalizeFinanceCurrency(value: unknown, fallback: FinanceCurrency = 'BRL'): FinanceCurrency {
  if (!isFinanceCurrency(value)) return fallback;
  return value.toUpperCase() as FinanceCurrency;
}

export function formatFinanceAmount(amount: number, currency: FinanceCurrency, locale = 'pt-BR'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}
