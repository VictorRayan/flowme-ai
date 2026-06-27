import {
  PRO_PRICES,
  annualSavingsCents,
  annualSavingsPercent,
  featureName,
  formatBrl,
} from '@/lib/billing/pricing';

describe('billing pricing', () => {
  it('keeps the approved monthly and annual prices', () => {
    expect(PRO_PRICES.monthly.billedAmountCents).toBe(5990);
    expect(PRO_PRICES.annual.billedAmountCents).toBe(47880);
    expect(PRO_PRICES.annual.amountCents).toBe(3990);
  });

  it('calculates the annual saving against twelve monthly payments', () => {
    expect(annualSavingsCents()).toBe(24000);
    expect(annualSavingsPercent()).toBe(33);
  });

  it('formats BRL prices for the product UI', () => {
    expect(formatBrl(5990)).toMatch(/59,90/);
    expect(formatBrl(47880)).toMatch(/478,80/);
  });

  it('uses human-facing feature names without exposing internal keys', () => {
    expect(featureName('connectors')).toBe('Conectores');
    expect(featureName('connectors', 'en')).toBe('Connectors');
    expect(featureName('today', 'pt')).toBe('Tarefas de Hoje');
    expect(featureName('today', 'en')).toBe('Today');
    expect(featureName('balys_limited')).toBeNull();
    expect(featureName(null)).toBeNull();
  });
});
