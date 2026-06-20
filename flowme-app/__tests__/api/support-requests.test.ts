import { NextRequest } from 'next/server';
import { GET } from '@/app/api/support/requests/route';

const rows = [{ id: 'request-1', status: 'open', created_at: '2026-06-20T00:00:00.000Z' }];
const mockEq = jest.fn();

function makeChain() {
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data: rows, error: null }).then(resolve as any, reject as any);
    },
  };
  for (const method of ['select', 'order', 'limit']) chain[method] = jest.fn().mockReturnValue(chain);
  chain.eq = mockEq.mockReturnValue(chain);
  return chain;
}

jest.mock('@/lib/api/auth', () => ({ requireAuth: jest.fn().mockResolvedValue({ user: { id: 'user-1' }, supabase: {} }) }));
jest.mock('@/lib/api/admin', () => ({ getSupabaseAdmin: jest.fn(() => ({ from: jest.fn(() => makeChain()) })) }));

describe('GET /api/support/requests', () => {
  it('returns only requests filtered to the authenticated user', async () => {
    const response = await GET(new NextRequest('http://localhost/api/support/requests'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.requests).toEqual(rows);
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
  });
});
