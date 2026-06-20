const mockGetUserEntitlements = jest.fn().mockResolvedValue({ features: { reviews: true } });
const mockIsFeatureAllowed = jest.fn().mockReturnValue(true);

jest.mock('@/lib/billing/entitlements', () => ({
  getUserEntitlements: (...args: unknown[]) => mockGetUserEntitlements(...args),
  isFeatureAllowed: (...args: unknown[]) => mockIsFeatureAllowed(...args),
}));

import {
  buildMonthlyCouncilSituation,
  buildMonthlyReviewEvidence,
  generateDueMonthlyReviews,
  generateMonthlyReviewContent,
  getClosedMonthlyReviewPeriod,
} from '@/lib/reviews/monthly-review';
import type { FinanceMonthlySummary } from '@/lib/finance/types';

const summary: FinanceMonthlySummary = {
  month: '2026-06',
  currency: 'BRL',
  total_income: 0,
  total_expenses: 1200,
  total_invested: 0,
  net_balance: -1200,
  investment_rate: null,
  category_breakdown: [{ category: 'alimentação', amount: 600, share: 0.5 }],
  largest_transactions: [{ id: 'secret', amount: 300, currency: 'BRL', occurred_on: '2026-06-10', category_name: 'alimentação', merchant: 'Restaurante', description: null }],
  recent_transactions: [],
  needs_review_count: 2,
  goal_alignment: [],
  recurring_expenses: [],
};

describe('monthly review', () => {
  beforeEach(() => {
    mockGetUserEntitlements.mockResolvedValue({ features: { reviews: true } });
    mockIsFeatureAllowed.mockReturnValue(true);
  });

  it('uses the current month on its last day', () => {
    expect(getClosedMonthlyReviewPeriod(new Date('2026-06-30T21:30:00Z'), 'UTC')).toEqual({
      start: '2026-06-01',
      end: '2026-06-30',
    });
  });

  it('uses the previous closed month before month end', () => {
    expect(getClosedMonthlyReviewPeriod(new Date('2026-06-15T12:00:00Z'), 'UTC')).toEqual({
      start: '2026-05-01',
      end: '2026-05-31',
    });
  });

  it('builds finance-only evidence and warns when income is missing', () => {
    const evidence = buildMonthlyReviewEvidence(summary);
    expect(evidence.income_missing).toBe(true);
    expect(evidence.alerts.join(' ')).toContain('Renda mensal não registrada');
    expect(buildMonthlyCouncilSituation(evidence)).toContain('não recomende um valor exato');
  });

  it('generates structured content without exact investment when income is missing', async () => {
    const evidence = buildMonthlyReviewEvidence(summary);
    const result = await generateMonthlyReviewContent(evidence, async () => ({ directive: 'Reduza delivery e organize renda.', mode: 'plan' }));
    expect(result.status).toBe('ready');
    expect(result.review_content?.investment_guidance).toContain('registre sua renda mensal');
  });

  it('surfaces behind financial goals in alerts and next month focus', async () => {
    const evidence = buildMonthlyReviewEvidence({
      ...summary,
      goal_alignment: [{
        goal_title: 'Poupar R$12K ao ano',
        target_period: 'annual',
        target_amount: 12000,
        monthly_target: 1000,
        actual_saved: 750,
        gap: -250,
        adherence: 0.75,
        currency: 'BRL',
        basis: 'parsed_goal_text',
        status: 'behind',
      }],
    });
    expect(evidence.alerts.join(' ')).toContain('Meta financeira abaixo do ritmo');
    const result = await generateMonthlyReviewContent(evidence, async () => ({ directive: 'Corte R$250 em gastos variáveis.', mode: 'plan' }));
    expect(result.review_content?.next_month_focus).toContain('Poupar R$12K ao ano');
    expect(result.review_content?.next_month_focus).toContain('realizado 750 BRL');
  });

  it('uses recurring expenses as cost-cutting evidence', async () => {
    const evidence = buildMonthlyReviewEvidence({
      ...summary,
      recurring_expenses: [{
        label: 'Netflix',
        category: 'assinaturas',
        currency: 'BRL',
        average_amount: 42.9,
        latest_amount: 42.9,
        monthly_impact: 42.9,
        occurrences: 3,
        months_seen: ['2026-04', '2026-05', '2026-06'],
        last_seen: '2026-06-05',
        frequency: 'monthly',
        confidence: 0.88,
        status: 'active',
      }],
    });

    expect(evidence.alerts.join(' ')).toContain('Custos recorrentes detectados');
    const result = await generateMonthlyReviewContent(evidence, async () => ({ directive: 'Revise assinaturas.', mode: 'plan' }));
    expect(result.review_content?.cuts_to_consider).toContain('Netflix');
  });

  it('generates due reviews only on the last day at configured time', async () => {
    const supabase = makeSupabase();
    const result = await generateDueMonthlyReviews(supabase, new Date('2026-06-30T18:30:00Z'), {
      councilRunner: async () => ({ directive: 'Organize o próximo mês.', mode: 'plan' }),
    });
    expect(result.inspected).toBe(1);
    expect(result.generated).toBe(1);
  });

  it('does not generate scheduled reviews for Free users', async () => {
    mockIsFeatureAllowed.mockReturnValue(false);
    const result = await generateDueMonthlyReviews(makeSupabase(), new Date('2026-06-30T18:30:00Z'));
    expect(result).toEqual({ inspected: 0, generated: 0, failed: 0 });
  });
});

function makeSupabase() {
  let table = '';
  const chain: any = {
    then(resolve: Function, reject: Function) {
      let data: any[] = [];
      if (table === 'user_profile') data = [{ user_id: 'user-1', briefing_timezone: 'UTC', monthly_review_enabled: true, monthly_review_time: '18:30' }];
      if (table === 'financial_transactions') data = [];
      return Promise.resolve({ data, error: null }).then(resolve as any, reject as any);
    },
  };
  const methods = ['select', 'eq', 'order', 'limit', 'upsert', 'gte', 'lte', 'in'];
  methods.forEach(method => { chain[method] = jest.fn().mockReturnValue(chain); });
  chain.from = jest.fn((name: string) => {
    table = name;
    return chain;
  });
  chain.maybeSingle = jest.fn().mockResolvedValue({ data: { user_id: 'user-1', default_currency: 'BRL' }, error: null });
  chain.single = jest.fn().mockImplementation(() => Promise.resolve({
    data: {
      user_id: 'user-1',
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      status: 'ready',
      evidence: buildMonthlyReviewEvidence({ ...summary, total_expenses: 0, category_breakdown: [] }),
      review_content: { financial_health: '', spending_pattern: '', investment_guidance: '', cuts_to_consider: '', next_month_focus: '', council_mode: 'plan' },
    },
    error: null,
  }));
  return chain;
}
