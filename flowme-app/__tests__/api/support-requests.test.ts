import { NextRequest } from 'next/server';
import { GET } from '@/app/api/support/requests/route';

const cancellationRows = [{ id: 'request-1', status: 'open', created_at: '2026-06-20T00:00:00.000Z' }];
const paymentRows = [{ id: 'payment-1', status: 'open', provider: 'stripe', created_at: '2026-06-21T00:00:00.000Z' }];
const mockEq = jest.fn();
const mockFrom = jest.fn();

function makeChain(data: Array<Record<string, unknown>>) {
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data, error: null }).then(resolve as any, reject as any);
    },
  };
  for (const method of ['select', 'order', 'limit']) chain[method] = jest.fn().mockReturnValue(chain);
  chain.eq = mockEq.mockReturnValue(chain);
  return chain;
}

jest.mock('@/lib/api/auth', () => ({ requireAuth: jest.fn().mockResolvedValue({ user: { id: 'user-1' }, supabase: {} }) }));
jest.mock('@/lib/api/admin', () => ({ getSupabaseAdmin: jest.fn(() => ({ from: mockFrom })) }));

describe('GET /api/support/requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockImplementation((table: string) => makeChain(table === 'billing_admin_alerts' ? paymentRows : cancellationRows));
  });

  it('returns only requests filtered to the authenticated user', async () => {
    const response = await GET(new NextRequest('http://localhost/api/support/requests'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.requests).toEqual([
      expect.objectContaining({ id: 'payment-1', type: 'payment_problem' }),
      expect.objectContaining({ id: 'request-1', type: 'cancellation' }),
    ]);
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
  });
});
