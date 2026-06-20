import { createHighAiCostAlerts, reconcileBilling } from '@/lib/billing/reconciliation';

function awaitable(result: unknown) {
  const value: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve(result).then(resolve as any, reject as any);
    },
  };
  for (const method of ['select', 'neq', 'gte', 'update', 'eq', 'upsert']) value[method] = jest.fn().mockReturnValue(value);
  return value;
}

describe('billing reconciliation', () => {
  it('records a completed empty reconciliation run', async () => {
    const runSingle = jest.fn().mockResolvedValue({ data: { id: 'run-1' }, error: null });
    const runUpdate = awaitable({ error: null });
    const subscriptions = awaitable({ data: [], error: null });
    const admin: any = {
      from: jest.fn((table: string) => {
        if (table === 'billing_reconciliation_runs') return {
          insert: jest.fn(() => ({ select: jest.fn(() => ({ single: runSingle })) })),
          update: jest.fn((payload: unknown) => { runUpdate.payload = payload; return runUpdate; }),
        };
        if (table === 'user_subscriptions') return subscriptions;
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    const result = await reconcileBilling(admin);
    expect(result).toEqual({ inspected: 0, matched: 0, repaired: 0, mismatched: 0 });
    expect(runUpdate.payload).toEqual(expect.objectContaining({ status: 'completed', inspected: 0 }));
  });

  it('opens one deduplicated alert for a user over the daily cost threshold', async () => {
    const usage = awaitable({ data: [
      { user_id: 'user-1', cost_usd: 3.25 },
      { user_id: 'user-1', cost_usd: 2.5 },
      { user_id: 'user-2', cost_usd: 1 },
    ], error: null });
    const upsert = jest.fn().mockResolvedValue({ error: null });
    const admin: any = { from: jest.fn((table: string) => table === 'ai_usage_logs' ? usage : { upsert }) };
    const oldThreshold = process.env.DAILY_AI_COST_ALERT_USD;
    process.env.DAILY_AI_COST_ALERT_USD = '5';
    const result = await createHighAiCostAlerts(admin, new Date('2026-06-20T12:00:00Z'));
    process.env.DAILY_AI_COST_ALERT_USD = oldThreshold;
    expect(result).toEqual({ inspected_users: 2, alerts: 1 });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'high_ai_cost', user_id: 'user-1', dedupe_key: 'high_ai_cost:2026-06-20:user-1',
    }), { onConflict: 'dedupe_key' });
  });
});
