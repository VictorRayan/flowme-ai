import { NextRequest } from 'next/server';
import { POST } from '@/app/api/billing/portal/route';

const mockPortalCreate = jest.fn().mockResolvedValue({ url: 'https://billing.stripe.test/session' });
const mockAdminFrom = jest.fn(() => makeChain());

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    billingPortal: { sessions: { create: mockPortalCreate } },
  })),
}));

function makeChain() {
  const chain: any = {
    select: jest.fn().mockReturnValue(undefined),
    eq: jest.fn().mockReturnValue(undefined),
    order: jest.fn().mockReturnValue(undefined),
    limit: jest.fn().mockReturnValue(undefined),
    maybeSingle: jest.fn().mockResolvedValue({ data: { provider_customer_id: 'cus_123' }, error: null }),
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

describe('POST /api/billing/portal', () => {
  const oldEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...oldEnv,
      STRIPE_SECRET_KEY: 'sk_test_123',
      NEXT_PUBLIC_APP_URL: 'https://app.flow-me.online',
    };
  });

  afterAll(() => {
    process.env = oldEnv;
  });

  it('creates a focused payment method update portal session', async () => {
    const res = await POST(new NextRequest('http://localhost/api/billing/portal', { method: 'POST' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, url: 'https://billing.stripe.test/session' });
    expect(mockPortalCreate).toHaveBeenCalledWith(expect.objectContaining({
      customer: 'cus_123',
      flow_data: expect.objectContaining({
        type: 'payment_method_update',
      }),
    }));
  });
});
