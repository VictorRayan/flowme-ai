import { NextRequest } from 'next/server';
import { POST } from '@/app/api/billing/checkout/route';

const mockCustomersCreate = jest.fn().mockResolvedValue({ id: 'cus_123' });
const mockSessionsCreate = jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.test/session' });
const mockUpsert = jest.fn().mockResolvedValue({ error: null });

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    customers: { create: mockCustomersCreate },
    checkout: { sessions: { create: mockSessionsCreate } },
  })),
}));

function makeChain(subscription: any = null) {
  const chain: any = {
    select: jest.fn().mockReturnValue(undefined),
    eq: jest.fn().mockReturnValue(undefined),
    order: jest.fn().mockReturnValue(undefined),
    limit: jest.fn().mockReturnValue(undefined),
    maybeSingle: jest.fn().mockResolvedValue({ data: subscription, error: null }),
    upsert: mockUpsert,
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
      user: { id: 'user-1', email: 'user@example.com' },
      supabase: { from: jest.fn(() => makeChain()) },
    })
  ),
}));

describe('POST /api/billing/checkout', () => {
  const oldEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...oldEnv,
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_PRO_MONTHLY_PRICE_ID: 'price_monthly',
      STRIPE_PRO_ANNUAL_PRICE_ID: 'price_annual',
      NEXT_PUBLIC_APP_URL: 'https://app.flow-me.online',
    };
  });

  afterAll(() => {
    process.env = oldEnv;
  });

  it('creates a monthly checkout session', async () => {
    const req = new NextRequest('http://localhost/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ interval: 'monthly' }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, url: 'https://checkout.stripe.test/session' });
    expect(mockCustomersCreate).toHaveBeenCalledWith(expect.objectContaining({
      email: 'user@example.com',
      metadata: { user_id: 'user-1' },
    }));
    expect(mockSessionsCreate).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'subscription',
      customer: 'cus_123',
      line_items: [{ price: 'price_monthly', quantity: 1 }],
    }));
  });

  it('rejects invalid intervals', async () => {
    const req = new NextRequest('http://localhost/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ interval: 'weekly' }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
