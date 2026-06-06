import { NextRequest } from 'next/server';
import { GET } from '@/app/api/billing/entitlements/route';

let subscriptionRow: any = null;

function makeSelectChain() {
  const chain: any = {
    select: jest.fn().mockReturnValue(undefined),
    eq: jest.fn().mockReturnValue(undefined),
    order: jest.fn().mockReturnValue(undefined),
    limit: jest.fn().mockReturnValue(undefined),
    maybeSingle: jest.fn().mockResolvedValue({ data: subscriptionRow, error: null }),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() =>
    Promise.resolve({
      user: { id: 'user-1' },
      supabase: {
        from: jest.fn(() => makeSelectChain()),
      },
    })
  ),
}));

describe('GET /api/billing/entitlements', () => {
  beforeEach(() => {
    subscriptionRow = null;
  });

  it('returns Free entitlements when the user has no subscription', async () => {
    const res = await GET(new NextRequest('http://localhost/api/billing/entitlements'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.entitlements.plan_code).toBe('free');
    expect(body.entitlements.features.notes).toBe(true);
    expect(body.entitlements.features.finance).toBe(false);
  });

  it('returns Pro entitlements for active Pro subscription', async () => {
    subscriptionRow = {
      plan_code: 'pro',
      status: 'active',
      current_period_end: '2026-07-06T00:00:00.000Z',
    };

    const res = await GET(new NextRequest('http://localhost/api/billing/entitlements'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.entitlements.plan_code).toBe('pro');
    expect(body.entitlements.has_pro).toBe(true);
    expect(body.entitlements.features.connectors).toBe(true);
  });
});
