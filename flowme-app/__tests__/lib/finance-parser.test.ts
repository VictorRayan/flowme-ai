import { parseFinancialTransaction } from '@/lib/finance/parse-transaction';

const now = new Date('2026-06-03T15:00:00.000Z');

describe('parseFinancialTransaction', () => {
  it('parses BRL lunch expense', () => {
    const parsed = parseFinancialTransaction('gastei R$42 no almoço hoje', { now, timezone: 'America/Sao_Paulo', defaultCurrency: 'BRL' });
    expect(parsed.amount).toBe(42);
    expect(parsed.currency).toBe('BRL');
    expect(parsed.type).toBe('expense');
    expect(parsed.category_name).toBe('alimentação');
    expect(parsed.occurred_on).toBe('2026-06-03');
    expect(parsed.needs_review).toBe(false);
  });

  it('parses decimal comma and yesterday transport', () => {
    const parsed = parseFinancialTransaction('Uber 28,90 ontem à noite', { now, timezone: 'America/Sao_Paulo', defaultCurrency: 'BRL' });
    expect(parsed.amount).toBe(28.9);
    expect(parsed.category_name).toBe('transporte');
    expect(parsed.merchant).toBe('Uber');
    expect(parsed.occurred_on).toBe('2026-06-02');
  });

  it('detects income', () => {
    const parsed = parseFinancialTransaction('recebi salário 8500', { now, defaultCurrency: 'BRL' });
    expect(parsed.type).toBe('income');
    expect(parsed.amount).toBe(8500);
    expect(parsed.category_name).toBe('salário');
  });

  it('detects investment', () => {
    const parsed = parseFinancialTransaction('investi 1000 no tesouro', { now, defaultCurrency: 'BRL' });
    expect(parsed.type).toBe('investment');
    expect(parsed.category_name).toBe('renda fixa');
  });

  it('marks unknown category for review', () => {
    const parsed = parseFinancialTransaction('gastei 77 em coisa aleatória', { now, defaultCurrency: 'BRL' });
    expect(parsed.category_name).toBe('outros');
    expect(parsed.needs_review).toBe(true);
  });
});
