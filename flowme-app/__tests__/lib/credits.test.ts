import {
  AI_CREDIT_COSTS,
  classifyBalysCreditCost,
  creditPreflightMessage,
  consumeAiCredits,
  getAiCreditState,
  getLocalDayWindow,
} from '@/lib/billing/credits';

function makeClient(events: Array<{ credits: number }> = [], hasSubscription = false) {
  const chain: any = {
    select: jest.fn(), eq: jest.fn(), gte: jest.fn(), lt: jest.fn(),
    order: jest.fn(), limit: jest.fn(), maybeSingle: jest.fn(),
  };
  for (const method of ['select', 'eq', 'gte', 'order', 'limit']) chain[method].mockReturnValue(chain);
  chain.lt.mockResolvedValue({ data: events, error: null });
  chain.maybeSingle.mockResolvedValue({
    data: hasSubscription ? { plan_code: 'pro', status: 'active', current_period_end: '2099-01-01T00:00:00Z' } : null,
    error: null,
  });
  return { from: jest.fn(() => chain), rpc: jest.fn(), chain };
}

describe('AI credit policy', () => {
  it('maps simple, tool, connector, and image requests to understandable costs', () => {
    expect(classifyBalysCreditCost({ needsTools: false }).credits).toBe(AI_CREDIT_COSTS.simple_chat);
    expect(classifyBalysCreditCost({ needsTools: true }).credits).toBe(AI_CREDIT_COSTS.tool_action);
    expect(classifyBalysCreditCost({ needsTools: true, action: 'gmail' }).credits).toBe(AI_CREDIT_COSTS.connector);
    expect(classifyBalysCreditCost({ needsTools: true, action: 'image' }).credits).toBe(AI_CREDIT_COSTS.image);
  });

  it('uses local midnight and handles a daylight-saving boundary', () => {
    const beforeDst = getLocalDayWindow(new Date('2026-03-07T17:00:00Z'), 'America/New_York');
    const dstDay = getLocalDayWindow(new Date('2026-03-08T17:00:00Z'), 'America/New_York');
    expect(beforeDst.start.toISOString()).toBe('2026-03-07T05:00:00.000Z');
    expect(beforeDst.end.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(dstDay.start.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(dstDay.end.toISOString()).toBe('2026-03-09T04:00:00.000Z');
  });

  it('resets usage by querying only the current local day', async () => {
    const client = makeClient([{ credits: 3 }, { credits: 2 }]);
    const state = await getAiCreditState(client, 'user-1', 'America/Sao_Paulo', new Date('2026-06-20T15:00:00Z'));
    expect(state.used).toBe(5);
    expect(state.remaining).toBe(0);
    expect(client.chain.gte).toHaveBeenCalledWith('created_at', '2026-06-20T03:00:00.000Z');
    expect(client.chain.lt).toHaveBeenCalledWith('created_at', '2026-06-21T03:00:00.000Z');
  });

  it('returns unlimited state for Pro while preserving usage telemetry', async () => {
    const client = makeClient([{ credits: 30 }], true);
    const state = await getAiCreditState(client, 'user-1', 'UTC', new Date('2026-06-20T12:00:00Z'));
    expect(state.unlimited).toBe(true);
    expect(state.remaining).toBeNull();
    expect(state.used).toBe(30);
  });

  it('delegates atomic consumption to the database function', async () => {
    const client = makeClient();
    client.rpc.mockResolvedValue({
      data: { allowed: true, plan_code: 'free', unlimited: false, daily_limit: 5, used: 3, remaining: 2, local_date: '2026-06-20', timezone: 'UTC', resets_at: '2026-06-21T00:00:00Z' },
      error: null,
    });
    const state = await consumeAiCredits({ supabase: client, userId: 'user-1', timezone: 'UTC', source: 'tool', featureKey: 'connector_read', credits: 3 });
    expect(state.remaining).toBe(2);
    expect(client.rpc).toHaveBeenCalledWith('consume_ai_credits', expect.objectContaining({ p_credits: 3, p_feature_key: 'connector_read' }));
  });

  it('explains an expensive action before provider execution when credits are insufficient', () => {
    expect(creditPreflightMessage(2, 4, true)).toBe('Essa ação usa 4 créditos; você tem 2.');
    expect(creditPreflightMessage(0, 1, true)).toContain('acabaram');
  });
});
