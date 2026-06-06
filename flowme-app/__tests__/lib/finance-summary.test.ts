import { buildFinanceSummary, getFinanceHealthTrend } from '@/lib/finance/finance';

const baseTransaction = {
  id: 'txn',
  user_id: 'user-1',
  type: 'expense' as const,
  amount: 100,
  currency: 'BRL' as const,
  converted_amount: null,
  converted_currency: null,
  exchange_rate: null,
  occurred_on: '2026-06-10',
  category_id: null,
  category_name: 'alimentação',
  merchant: null,
  description: null,
  payment_method: null,
  source: 'web' as const,
  raw_text: null,
  confidence: null,
  status: 'confirmed' as const,
};

describe('finance summary', () => {
  it('detects recurring monthly expenses from repeated merchants', () => {
    const summary = buildFinanceSummary([
      { ...baseTransaction, id: 'netflix-1', amount: 39.9, occurred_on: '2026-04-05', merchant: 'Netflix', category_name: 'assinaturas' },
      { ...baseTransaction, id: 'netflix-2', amount: 39.9, occurred_on: '2026-05-05', merchant: 'Netflix', category_name: 'assinaturas' },
      { ...baseTransaction, id: 'netflix-3', amount: 42.9, occurred_on: '2026-06-05', merchant: 'Netflix', category_name: 'assinaturas' },
      { ...baseTransaction, id: 'lunch', amount: 50, occurred_on: '2026-06-10', merchant: 'Restaurante', category_name: 'alimentação' },
    ], {
      month: '2026-06',
      currency: 'BRL',
    });

    expect(summary.recurring_expenses).toEqual([
      expect.objectContaining({
        label: 'Netflix',
        category: 'assinaturas',
        occurrences: 3,
        months_seen: ['2026-04', '2026-05', '2026-06'],
        status: 'active',
      }),
    ]);
    expect(summary.recurring_expenses[0].average_amount).toBe(40.9);
  });

  it('includes financial goal alignment in monthly summary', () => {
    const summary = buildFinanceSummary([
      { ...baseTransaction, type: 'income', amount: 3000, category_name: 'salário' },
      { ...baseTransaction, type: 'investment', amount: 700, category_name: 'renda fixa' },
      { ...baseTransaction, amount: 2300, category_name: 'moradia' },
    ], {
      month: '2026-06',
      currency: 'BRL',
      goals: [{ title: 'Poupar R$12K ao ano', timeframe: 'yearly', status: 'in_progress' }],
    });
    expect(summary.goal_alignment[0]).toEqual(expect.objectContaining({
      monthly_target: 1000,
      actual_saved: 700,
      status: 'behind',
    }));
  });

  it('builds a multi-month health trend', async () => {
    const supabase = makeSupabase();
    const trend = await getFinanceHealthTrend(supabase, 'user-1', { endMonth: '2026-06', months: 3 });
    expect(trend.map(item => item.month)).toEqual(['2026-04', '2026-05', '2026-06']);
    expect(trend[2].total_expenses).toBe(100);
  });
});

function makeSupabase() {
  let table = '';
  const chain: any = {
    then(resolve: Function, reject: Function) {
      let data: any[] = [];
      if (table === 'financial_transactions') data = [baseTransaction];
      if (table === 'smart_goals') data = [{ title: 'Poupar R$12K ao ano', timeframe: 'yearly', status: 'in_progress' }];
      return Promise.resolve({ data, error: null }).then(resolve as any, reject as any);
    },
  };
  const methods = ['select', 'eq', 'order', 'limit', 'gte', 'lte', 'in'];
  methods.forEach(method => { chain[method] = jest.fn().mockReturnValue(chain); });
  chain.from = jest.fn((name: string) => {
    table = name;
    return chain;
  });
  chain.maybeSingle = jest.fn().mockResolvedValue({
    data: { user_id: 'user-1', default_currency: 'BRL' },
    error: null,
  });
  chain.single = jest.fn().mockResolvedValue({ data: { user_id: 'user-1', default_currency: 'BRL' }, error: null });
  return chain;
}
