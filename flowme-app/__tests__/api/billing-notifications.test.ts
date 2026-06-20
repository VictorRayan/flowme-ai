import { NextRequest } from 'next/server';
import { GET, PATCH } from '@/app/api/billing/notifications/route';

const mockRequireAuth = jest.fn();

jest.mock('@/lib/api/auth', () => ({ requireAuth: (...args: unknown[]) => mockRequireAuth(...args) }));

function makeChain(data: unknown = null) {
  const chain: any = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data, error: null }),
    then(resolve: Function) { return Promise.resolve({ data, error: null }).then(resolve as any); },
  };
  return chain;
}

describe('/api/billing/notifications', () => {
  it('returns the latest active billing notification', async () => {
    const chain = makeChain({ id: 'n1', kind: 'payment_failed', provider: 'stripe', created_at: '2026-06-20' });
    mockRequireAuth.mockResolvedValue({ user: { id: 'user-1' }, supabase: { from: jest.fn().mockReturnValue(chain) } });
    const response = await GET(new NextRequest('http://localhost/api/billing/notifications'));
    expect(await response.json()).toEqual(expect.objectContaining({ ok: true, notification: expect.objectContaining({ id: 'n1' }) }));
  });

  it('dismisses only a notification owned by the current user', async () => {
    const chain = makeChain();
    mockRequireAuth.mockResolvedValue({ user: { id: 'user-1' }, supabase: { from: jest.fn().mockReturnValue(chain) } });
    const response = await PATCH(new NextRequest('http://localhost/api/billing/notifications', {
      method: 'PATCH', body: JSON.stringify({ id: 'n1' }), headers: { 'content-type': 'application/json' },
    }));
    expect(response.status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith({ status: 'dismissed' });
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });
});
