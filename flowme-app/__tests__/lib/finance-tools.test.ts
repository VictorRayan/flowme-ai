import {
  financeAnalyzeHealthTool,
  financeGetHealthTrendTool,
  financeGetMonthSummaryTool,
  financeGetPeriodSummaryTool,
  financeListTransactionsTool,
  financeRecordTransactionTool,
  financeUpdateLatestTransactionTool,
} from '@/lib/ai/tools/finance-tools';

const transaction = {
  id: 'txn-secret',
  user_id: 'user-1',
  type: 'expense',
  amount: 42,
  currency: 'BRL',
  converted_amount: null,
  converted_currency: null,
  exchange_rate: null,
  occurred_on: '2026-06-03',
  category_id: null,
  category_name: 'alimentação',
  merchant: null,
  description: 'gastei 42 no almoço',
  payment_method: null,
  source: 'balys',
  raw_text: 'gastei 42 no almoço',
  confidence: 0.92,
  status: 'confirmed',
};

function makeSupabase() {
  let table = '';
  let patch: Record<string, unknown> = {};
  const chain: any = {
    then(resolve: Function, reject: Function) {
      const data = table === 'financial_transactions' ? [transaction] : [];
      return Promise.resolve({ data, error: null }).then(resolve as any, reject as any);
    },
  };
  const methods = ['select', 'eq', 'order', 'limit', 'insert', 'update', 'delete', 'upsert', 'gte', 'lte', 'ilike', 'in'];
  methods.forEach(method => { chain[method] = jest.fn().mockReturnValue(chain); });
  chain.update = jest.fn((value: Record<string, unknown>) => {
    patch = value;
    return chain;
  });
  chain.from = jest.fn((name: string) => {
    table = name;
    return chain;
  });
  chain.maybeSingle = jest.fn().mockResolvedValue({
    data: { user_id: 'user-1', default_currency: 'BRL', monthly_income_target: null, monthly_investment_target: null, emergency_reserve_target: null, main_financial_objective: null, risk_profile: null },
    error: null,
  });
  chain.single = jest.fn().mockImplementation(() => Promise.resolve({
    data: table === 'financial_transactions' ? { ...transaction, ...patch } : { user_id: 'user-1', default_currency: 'BRL' },
    error: null,
  }));
  return chain;
}

const context: any = {
  supabase: makeSupabase(),
  user: { id: 'user-1' },
  nowIso: '2026-06-03T15:00:00.000Z',
  timezone: 'America/Sao_Paulo',
};

describe('finance tools', () => {
  it('records a transaction from natural text without exposing id', async () => {
    const result = await financeRecordTransactionTool.call({ raw_text: 'gastei 42 no almoço' }, context);
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result.receipt)).not.toContain('txn-secret');
    expect(JSON.stringify(result.receipt)).toContain('alimentação');
  });

  it('asks follow-up when amount is missing', async () => {
    const result = await financeRecordTransactionTool.call({ raw_text: 'gastei no almoço' }, context);
    expect(result.receipt).toEqual(expect.objectContaining({ needs_follow_up: true }));
  });

  it('reads deterministic monthly summary', async () => {
    const result = await financeGetMonthSummaryTool.call({ month: '2026-06' }, context);
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result.receipt)).toContain('R$');
  });

  it('reads deterministic period summary for today or date range', async () => {
    const result = await financeGetPeriodSummaryTool.call({ start: '2026-06-03', end: '2026-06-03' }, context);
    expect(result.ok).toBe(true);
    expect(result.receipt).toEqual(expect.objectContaining({
      period: { start: '2026-06-03', end: '2026-06-03' },
      total_expenses: expect.stringContaining('R$'),
    }));
  });

  it('lists itemized transactions for a month', async () => {
    const result = await financeListTransactionsTool.call({ month: '2026-06', limit: 50 }, context);
    expect(result.ok).toBe(true);
    expect(result.receipt).toEqual(expect.objectContaining({ count: 1 }));
    expect(JSON.stringify(result.receipt)).toContain('alimentação');
  });

  it('returns health analysis evidence and cut candidates', async () => {
    const result = await financeAnalyzeHealthTool.call({ month: '2026-06' }, context);
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result.receipt)).toContain('cut_candidates');
  });

  it('returns multi-month financial health trend', async () => {
    const result = await financeGetHealthTrendTool.call({ months: 3, end_month: '2026-06' }, context);
    expect(result.ok).toBe(true);
    expect((result.receipt as any).months).toHaveLength(3);
  });

  it('updates a recent transaction by human-facing context', async () => {
    const result = await financeUpdateLatestTransactionTool.call({ search_text: 'almoço', category_name: 'trabalho' }, context);
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result.receipt)).not.toContain('txn-secret');
    expect(JSON.stringify(result.receipt)).toContain('trabalho');
  });
});
