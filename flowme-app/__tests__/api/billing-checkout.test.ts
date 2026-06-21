import { NextRequest } from 'next/server';
import { POST } from '@/app/api/billing/checkout/route';

const mockCreateCheckout = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'user@example.com', user_metadata: { full_name: 'User One' } },
    supabase: {},
  }),
}));

jest.mock('@/lib/api/admin', () => ({
  getSupabaseAdmin: jest.fn(() => ({ from: mockFrom })),
}));

jest.mock('@/lib/billing/providers/registry', () => ({
  getBillingGateway: jest.fn(() => ({ createCheckout: mockCreateCheckout })),
}));

function chain(singleData: unknown = null) {
  const value: Record<string, jest.Mock> = {};
  ['select', 'eq', 'order', 'limit', 'insert', 'update', 'not'].forEach(method => {
    value[method] = jest.fn().mockReturnValue(value);
  });
  value.maybeSingle = jest.fn().mockResolvedValue({ data: singleData, error: null });
  value.single = jest.fn().mockResolvedValue({ data: singleData, error: null });
  value.then = jest.fn((resolve: (result: unknown) => unknown) => Promise.resolve({ data: singleData, error: null }).then(resolve));
  return value;
}

describe('POST /api/billing/checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const attempts = [chain(null), chain({ id: 'attempt-1' }), chain(null)];
    mockFrom.mockImplementation((table: string) => {
      if (table === 'billing_payment_method_routes') return chain({ provider: 'stripe', currency: 'BRL' });
      if (table === 'subscription_prices') return chain({ id: 'price-row-1', provider_price_id: 'price_monthly', currency: 'BRL', amount_cents: 5990 });
      if (table === 'subscription_plan_localizations') return chain({ name: 'Flow Me Pro', description: 'Flow Me Pro subscription' });
      if (table === 'user_subscriptions') return chain(null);
      if (table === 'billing_checkout_attempts') return attempts.shift() || chain(null);
      return chain(null);
    });
    mockCreateCheckout.mockResolvedValue({
      kind: 'stripe_elements',
      provider: 'stripe',
      providerCustomerId: 'cus_1',
      providerCheckoutId: 'cs_1',
      providerSubscriptionId: null,
      providerPaymentId: null,
      clientSecret: 'secret',
      expiresAt: '2026-06-22T12:00:00Z',
    });
  });

  it('creates a provider-neutral checkout attempt', async () => {
    const req = new NextRequest('http://localhost/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ interval: 'monthly', payment_method: 'card', locale: 'pt-BR' }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.attempt_id).toBe('attempt-1');
    expect(body.checkout.kind).toBe('stripe_elements');
    expect(mockCreateCheckout).toHaveBeenCalledWith(expect.objectContaining({
      attemptId: 'attempt-1',
      interval: 'monthly',
      paymentMethod: 'card',
      providerPriceId: 'price_monthly',
    }));
  });

  it('requires payer data for Pix', async () => {
    const req = new NextRequest('http://localhost/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ interval: 'monthly', payment_method: 'pix' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
    expect(mockCreateCheckout).not.toHaveBeenCalled();
  });

  it('rejects invalid intervals', async () => {
    const req = new NextRequest('http://localhost/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ interval: 'weekly' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
