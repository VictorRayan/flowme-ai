import { NextRequest } from 'next/server';
import { POST } from '@/app/api/support/cancellation-requests/route';

const mockInsert = jest.fn();
const mockSelectAfterInsert = jest.fn();
const mockSingle = jest.fn();
const mockAlertInsert = jest.fn();

function makeSubscriptionChain() {
  const chain: any = {
    select: jest.fn().mockReturnValue(undefined),
    eq: jest.fn().mockReturnValue(undefined),
    order: jest.fn().mockReturnValue(undefined),
    limit: jest.fn().mockReturnValue(undefined),
    maybeSingle: jest.fn().mockResolvedValue({
      data: { id: 'sub-row-1', billing_provider: 'stripe' },
      error: null,
    }),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

function makeCancellationChain() {
  const chain: any = {
    select: jest.fn(), eq: jest.fn(), in: jest.fn(), limit: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    insert: mockInsert.mockReturnValue({
      select: mockSelectAfterInsert.mockReturnValue({
        single: mockSingle,
      }),
    }),
  };
  for (const method of ['select', 'eq', 'in', 'limit']) chain[method].mockReturnValue(chain);
  return chain;
}

function makeFunnelChain() {
  const chain: any = { maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'funnel-1', current_stage: 'cancel_subscription', expires_at: '2099-01-01T00:00:00.000Z' }, error: null }) };
  for (const method of ['select', 'eq']) chain[method] = jest.fn().mockReturnValue(chain);
  return chain;
}

const mockFrom = jest.fn((table: string) => {
  if (table === 'user_subscriptions') return makeSubscriptionChain();
  if (table === 'subscription_cancellation_funnel_sessions') return makeFunnelChain();
  if (table === 'subscription_cancellation_requests') return makeCancellationChain();
  if (table === 'billing_admin_alerts') return { insert: mockAlertInsert };
  if (table === 'subscription_cancellation_request_events') return { insert: jest.fn().mockResolvedValue({ error: null }) };
  return {};
});

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() =>
    Promise.resolve({
      user: { id: 'user-1' },
      supabase: {},
    })
  ),
}));

jest.mock('@/lib/api/admin', () => ({
  getSupabaseAdmin: jest.fn(() => ({ from: mockFrom })),
}));

describe('POST /api/support/cancellation-requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSingle.mockResolvedValue({
      data: { id: 'cancel-1', status: 'open', created_at: '2026-06-06T00:00:00.000Z' },
      error: null,
    });
    mockAlertInsert.mockResolvedValue({ error: null });
  });

  it('creates an open cancellation request with the active subscription context', async () => {
    const req = new NextRequest('http://localhost/api/support/cancellation-requests', {
      method: 'POST',
      body: JSON.stringify({
        funnel_session_id: 'funnel-1',
        reason_code: 'not_using',
        locale: 'pt-BR',
        reason: 'Eu quero cancelar porque não consegui encaixar o Flow Me na minha rotina diária e ainda não percebi retorno claro suficiente para justificar a cobrança mensal.',
        disappointing_features: 'Revisões e conectores',
        unmet_expectation: 'Esperava orientação mais prática no dia a dia',
        would_accept_human_support: true,
        source: 'billing_page',
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.request).toEqual({ id: 'cancel-1', status: 'open', created_at: '2026-06-06T00:00:00.000Z' });
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      subscription_id: 'sub-row-1',
      billing_provider: 'stripe',
      source: 'billing_page',
      status: 'open',
    }));
    expect(mockAlertInsert).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'cancellation_request',
      user_id: 'user-1',
      provider: 'stripe',
    }));
  });

  it('rejects cancellation requests with short reasons', async () => {
    const req = new NextRequest('http://localhost/api/support/cancellation-requests', {
      method: 'POST',
      body: JSON.stringify({
        funnel_session_id: 'funnel-1',
        reason_code: 'other',
        reason: 'curto',
        disappointing_features: 'Conectores',
        unmet_expectation: 'Mais clareza',
        would_accept_human_support: false,
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('CANCELLATION_REASON_REQUIRED');
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
