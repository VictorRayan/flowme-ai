export type CatalogLocale = 'pt-BR' | 'en-US';

export function normalizeCatalogLocale(value: unknown): CatalogLocale {
  const normalized = String(value || '').replace('_', '-').toLowerCase();
  return normalized === 'en-us' || normalized.startsWith('en-') ? 'en-US' : 'pt-BR';
}

export function annualSavings(monthlyAmountCents: number, annualAmountCents: number) {
  const comparison = Math.max(0, monthlyAmountCents * 12);
  const amountCents = Math.max(0, comparison - Math.max(0, annualAmountCents));
  return {
    amountCents,
    percent: comparison > 0 ? Math.round((amountCents / comparison) * 100) : 0,
  };
}
