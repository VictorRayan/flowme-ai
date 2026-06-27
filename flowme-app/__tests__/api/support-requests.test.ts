import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/support/requests/route';

const cancellationRows = [{ id: 'request-1', status: 'open', created_at: '2026-06-20T00:00:00.000Z' }];
const supportRows = [{ id: 'support-1', status: 'open', category: 'payment', subject: 'Cobrança duplicada', created_at: '2026-06-21T00:00:00.000Z' }];
const mockEq = jest.fn();
const mockInsert = jest.fn();
const mockFrom = jest.fn();

function makeListChain(data: Array<Record<string, unknown>>) {
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data, error: null }).then(resolve as any, reject as any);
    },
  };
  for (const method of ['select', 'order', 'limit']) chain[method] = jest.fn().mockReturnValue(chain);
  chain.eq = mockEq.mockReturnValue(chain);
  return chain;
}

function makeMutationChain(existing: Record<string, unknown> | null = null) {
  const chain: any = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.maybeSingle = jest.fn().mockResolvedValue({ data: existing, error: null });
  chain.insert = mockInsert.mockReturnValue({
    select: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({
        data: { id: 'support-2', category: 'payment', status: 'open', subject: 'Cartão recusado', created_at: '2026-06-22T00:00:00.000Z' },
        error: null,
      }),
    }),
  });
  return chain;
}

jest.mock('@/lib/api/auth', () => ({ requireAuth: jest.fn().mockResolvedValue({ user: { id: 'user-1' }, supabase: {} }) }));
jest.mock('@/lib/api/admin', () => ({ getSupabaseAdmin: jest.fn(() => ({ from: mockFrom })) }));

describe('GET /api/support/requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockImplementation((table: string) => makeListChain(table === 'support_requests' ? supportRows : cancellationRows));
  });

  it('returns only requests filtered to the authenticated user', async () => {
    const response = await GET(new NextRequest('http://localhost/api/support/requests'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.requests).toEqual([
      expect.objectContaining({ id: 'support-1', type: 'support', category: 'payment' }),
      expect.objectContaining({ id: 'request-1', type: 'cancellation' }),
    ]);
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
  });
});

describe('POST /api/support/requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'support_requests') return makeMutationChain();
      if (table === 'user_subscriptions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: { billing_provider: 'stripe', plan_code: 'pro', status: 'active' }, error: null }),
        };
      }
      if (table === 'billing_admin_alerts') return { upsert: jest.fn().mockResolvedValue({ error: null }) };
      return makeListChain([]);
    });
  });

  it('creates a generic payment support request with billing escalation metadata', async () => {
    const response = await POST(new NextRequest('http://localhost/api/support/requests', {
      method: 'POST',
      body: JSON.stringify({
        category: 'payment',
        subject: 'Cartão recusado no checkout',
        details: 'Meu cartão foi recusado hoje no checkout mesmo com limite disponível e não consegui concluir a compra.',
        expected_outcome: 'Quero revisar a cobrança e entender como concluir o pagamento.',
        locale: 'pt-BR',
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.request).toEqual(expect.objectContaining({ id: 'support-2', category: 'payment', status: 'open' }));
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      category: 'payment',
      status: 'open',
    }));
  });

  it('rejects short support request details', async () => {
    const response = await POST(new NextRequest('http://localhost/api/support/requests', {
      method: 'POST',
      body: JSON.stringify({
        category: 'bug',
        subject: 'Erro no app',
        details: 'quebrou',
        expected_outcome: 'corrigir o erro no app',
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.message).toBe('SUPPORT_REQUEST_DETAILS_INVALID');
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
