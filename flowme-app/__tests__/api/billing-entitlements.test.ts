import { NextRequest } from 'next/server';
import { GET } from '@/app/api/billing/entitlements/route';

let subscriptionRow: any = null;
const mockAdminFrom = jest.fn(() => makeSelectChain());

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
      supabase: {},
    })
  ),
}));

jest.mock('@/lib/api/admin', () => ({
  getSupabaseAdmin: jest.fn(() => ({ from: mockAdminFrom })),
}));

describe('GET /api/billing/entitlements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    subscriptionRow = null;
  });

  it('returns Free entitlements when the user has no subscription', async () => {
    const res = await GET(new NextRequest('http://localhost/api/billing/entitlements'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.entitlements.plan_code).toBe('free');
    expect(body.entitlements.features.notes).toBe(true);
    expect(body.entitlements.features.connectors).toBe(true);
    expect(body.entitlements.features.finance).toBe(false);
    expect(body.billing).toEqual({
      provider: null,
      state: 'free',
      current_period_end: null,
      cancel_at_period_end: false,
      management_surface: 'none',
    });
  });

  it('returns Pro entitlements for active Pro subscription', async () => {
    subscriptionRow = {
      plan_code: 'pro',
      billing_provider: 'stripe',
      status: 'active',
      current_period_end: '2099-07-06T00:00:00.000Z',
      cancel_at_period_end: false,
    };

    const res = await GET(new NextRequest('http://localhost/api/billing/entitlements'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.entitlements.plan_code).toBe('pro');
    expect(body.entitlements.has_pro).toBe(true);
    expect(body.entitlements.features.connectors).toBe(true);
    expect(body.billing).toEqual({
      provider: 'stripe',
      state: 'active',
      current_period_end: '2099-07-06T00:00:00.000Z',
      cancel_at_period_end: false,
      management_surface: 'stripe',
    });
  });
});
