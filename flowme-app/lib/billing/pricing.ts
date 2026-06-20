import type { FeatureKey } from './entitlements';

export type BillingInterval = 'monthly' | 'annual';

export const PRO_PRICES = {
  monthly: {
    amountCents: 5990,
    billedAmountCents: 5990,
    billedEvery: 'mês',
  },
  annual: {
    amountCents: 3990,
    billedAmountCents: 47880,
    billedEvery: 'ano',
  },
} as const;

const FEATURE_NAMES: Partial<Record<FeatureKey, string>> = {
  calendar: 'Calendário',
  today: 'Today',
  goals: 'Metas e planos',
  finance: 'Finanças',
  reviews: 'Revisões',
  connectors: 'Conectores',
  whatsapp: 'WhatsApp',
  briefings: 'Briefings',
  reminders: 'Lembretes',
  meetings: 'Reuniões',
  images: 'Geração de imagens',
};

export function formatBrl(amountCents: number): string {
  return (amountCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function annualSavingsCents(): number {
  return PRO_PRICES.monthly.billedAmountCents * 12 - PRO_PRICES.annual.billedAmountCents;
}

export function annualSavingsPercent(): number {
  const monthlyYear = PRO_PRICES.monthly.billedAmountCents * 12;
  return Math.round((annualSavingsCents() / monthlyYear) * 100);
}

export function featureName(feature: FeatureKey | null): string | null {
  return feature ? FEATURE_NAMES[feature] || null : null;
}
