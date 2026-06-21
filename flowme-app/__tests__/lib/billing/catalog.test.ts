import { annualSavings, normalizeCatalogLocale } from '@/lib/billing/catalog';

describe('billing catalog', () => {
  it('normalizes supported locales and falls back to pt-BR', () => {
    expect(normalizeCatalogLocale('en-us')).toBe('en-US');
    expect(normalizeCatalogLocale('pt_BR')).toBe('pt-BR');
    expect(normalizeCatalogLocale('fr-FR')).toBe('pt-BR');
  });

  it('computes the annual savings against twelve monthly payments', () => {
    expect(annualSavings(5990, 47880)).toEqual({ amountCents: 24000, percent: 33 });
  });

  it('never returns a negative discount', () => {
    expect(annualSavings(1000, 12000)).toEqual({ amountCents: 0, percent: 0 });
    expect(annualSavings(1000, 13000)).toEqual({ amountCents: 0, percent: 0 });
  });
});
