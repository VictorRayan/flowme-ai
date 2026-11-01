import { NextRequest } from 'next/server';
import { POST as POST_PUBLIC_CHECKOUT } from '@/app/api/billing/public-checkout/route';
import { POST as POST_CLAIM } from '@/app/api/billing/public-checkout/claim/route';
import { createSignedMarketingToken, createSignedMarketingToken as createToken } from '@/lib/marketing/signed-token';
import { requireAuth } from '@/lib/api/auth';

const mockCreateCheckout = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/api/admin', () => ({
  getSupabaseAdmin: jest.fn(() => ({ from: mockFrom })),
}));

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'buyer@example.com', email_confirmed_at: '2026-06-28T09:00:00Z' },
    supabase: {},
  }),
}));

jest.mock('@/lib/billing/providers/registry', () => ({
  getBillingGateway: jest.fn(() => ({ createCheckout: mockCreateCheckout })),
}));

jest.mock('@/lib/billing/ip-country', () => ({
  resolveRequestCountry: jest.fn().mockResolvedValue('BR'),
}));

function chain(singleData: unknown = null) {
  const value: Record<string, jest.Mock> = {};
  ['select', 'eq', 'order', 'limit', 'insert', 'update', 'upsert', 'not'].forEach(method => {
    value[method] = jest.fn().mockReturnValue(value);
  });
  value.maybeSingle = jest.fn().mockResolvedValue({ data: singleData, error: null });
  value.single = jest.fn().mockResolvedValue({ data: singleData, error: null });
  value.then = jest.fn((resolve: (result: unknown) => unknown) => Promise.resolve({ data: singleData, error: null }).then(resolve));
  return value;
}

describe('public checkout', () => {
  let insertedCheckout: Record<string, unknown> | null;

  beforeEach(() => {
    jest.clearAllMocks();
    insertedCheckout = null;
    process.env.PUBLIC_CHECKOUT_TOKEN_SECRET = 'test-public-token-secret';
    const publicSessions = [chain(null), chain({ id: 'public-1' }), chain(null)];
    mockFrom.mockImplementation((table: string) => {
      if (table === 'marketing_leads') return chain({ id: 'lead-1', email: 'buyer@example.com', name: 'Buyer', phone: '(11) 99999-9999', phone_e164: '+5511999999999', locale: 'pt-BR', source: 'lp_pt-br', visitor_id: 'visitor-1', meta_external_id: 'visitor-1' });
      if (table === 'billing_payment_method_routes') return chain({ provider: 'stripe', currency: 'BRL' });
      if (table === 'subscription_prices') return chain({ id: 'price-row-1', provider_price_id: 'price_annual', currency: 'BRL', amount_cents: 47880 });
      if (table === 'subscription_plan_localizations') return chain({ name: 'Flow Me Pro', description: 'Flow Me Pro subscription' });
      if (table === 'public_checkout_sessions') {
        const next = publicSessions.shift() || chain(null);
        next.insert.mockImplementation((payload: Record<string, unknown>) => {
          insertedCheckout = payload;
          return next;
        });
        return next;
      }
      if (table === 'user_subscriptions') return chain(null);
      if (table === 'user_entitlements') return chain(null);
      return chain(null);
    });
    mockCreateCheckout.mockResolvedValue({
      kind: 'stripe_card_subscription',
      provider: 'stripe',
      providerCustomerId: 'cus_1',
      providerCheckoutId: 'sub_1',
      providerSubscriptionId: 'sub_1',
      providerPaymentId: null,
      confirmationClientSecret: 'secret',
      expiresAt: null,
    });
  });

  it('creates a public checkout from a signed lead token', async () => {
    const leadToken = createSignedMarketingToken({ kind: 'lead', id: 'lead-1', email: 'buyer@example.com' });
    const response = await POST_PUBLIC_CHECKOUT(new NextRequest('http://localhost/api/billing/public-checkout', {
      method: 'POST',
      body: JSON.stringify({ lead_token: leadToken, interval: 'annual', payment_method: 'card', payment_method_id: 'pm_card_1', locale: 'pt-BR' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.email).toBe('buyer@example.com');
    expect(body.public_checkout_token).toEqual(expect.any(String));
    expect(mockCreateCheckout).toHaveBeenCalledWith(expect.objectContaining({
      attemptId: 'public-1',
      userId: null,
      publicCheckoutSessionId: 'public-1',
      userEmail: 'buyer@example.com',
    }));
    expect(insertedCheckout).toEqual(expect.objectContaining({
      lead_id: 'lead-1',
      meta_external_id: 'visitor-1',
    }));
  });

  it('creates a direct public checkout without a lead token when email is provided', async () => {
    const response = await POST_PUBLIC_CHECKOUT(new NextRequest('http://localhost/api/billing/public-checkout', {
      method: 'POST',
      body: JSON.stringify({
        direct_checkout: true,
        customer_email: 'direct@example.com',
        customer_name: 'Direct Buyer',
        interval: 'annual',
        payment_method: 'card',
        payment_method_id: 'pm_card_1',
        locale: 'pt-BR',
        source: 'lp_pt-br',
        meta_external_id: 'visitor-direct',
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.email).toBe('direct@example.com');
    expect(body.public_checkout_token).toEqual(expect.any(String));
    expect(mockCreateCheckout).toHaveBeenCalledWith(expect.objectContaining({
      userEmail: 'direct@example.com',
      customerName: 'Direct Buyer',
    }));
    expect(insertedCheckout).toEqual(expect.objectContaining({
      lead_id: null,
      email: 'direct@example.com',
      customer_name: 'Direct Buyer',
      meta_external_id: 'visitor-direct',
      metadata: expect.objectContaining({ direct_checkout: true }),
    }));
  });

  it('rejects Pix on the monthly plan before creating a public checkout session', async () => {
    const leadToken = createSignedMarketingToken({ kind: 'lead', id: 'lead-1', email: 'buyer@example.com' });
    const response = await POST_PUBLIC_CHECKOUT(new NextRequest('http://localhost/api/billing/public-checkout', {
      method: 'POST',
      body: JSON.stringify({
        lead_token: leadToken,
        interval: 'monthly',
        payment_method: 'pix',
        customer_name: 'Buyer',
        cpf_cnpj: '12345678909',
        locale: 'pt-BR',
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toEqual({ code: 'VALIDATION_ERROR', message: 'Pix está disponível apenas no plano anual.' });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockCreateCheckout).not.toHaveBeenCalled();
  });

  it('claims a paid public checkout only for the authenticated matching email', async () => {
    const checkoutToken = createToken({ kind: 'public_checkout', id: 'public-1', email: 'buyer@example.com' });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'public_checkout_sessions') return chain({
        id: 'public-1',
        email: 'buyer@example.com',
        plan_code: 'pro',
        provider: 'stripe',
        provider_customer_id: 'cus_1',
        provider_subscription_id: 'sub_1',
        provider_payment_id: null,
        billing_interval: 'annual',
        status: 'paid',
        paid_at: '2026-06-28T10:00:00Z',
        currency: 'BRL',
        amount_cents: 47880,
        metadata: {},
      });
      if (table === 'user_subscriptions') return chain(null);
      if (table === 'user_entitlements') return chain(null);
      return chain(null);
    });

    const response = await POST_CLAIM(new NextRequest('http://localhost/api/billing/public-checkout/claim', {
      method: 'POST',
      body: JSON.stringify({ token: checkoutToken }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.claimed).toBe(true);
  });

  it('does not transfer an already claimed checkout to another account', async () => {
    const checkoutToken = createToken({ kind: 'public_checkout', id: 'public-1', email: 'buyer@example.com' });
    const subscriptions = chain(null);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'public_checkout_sessions') return chain({
        id: 'public-1', email: 'buyer@example.com', claimed_user_id: 'another-user', status: 'claimed',
      });
      if (table === 'user_subscriptions') return subscriptions;
      return chain(null);
    });
    const response = await POST_CLAIM(new NextRequest('http://localhost/api/billing/public-checkout/claim', {
      method: 'POST', body: JSON.stringify({ token: checkoutToken }),
    }));
    expect(response.status).toBe(404);
    expect(subscriptions.upsert).not.toHaveBeenCalled();
  });

  it('rejects a claim from an account without a verified email', async () => {
    (requireAuth as jest.Mock).mockResolvedValueOnce({ user: { id: 'user-1', email: 'buyer@example.com', email_confirmed_at: null } });
    const checkoutToken = createToken({ kind: 'public_checkout', id: 'public-1', email: 'buyer@example.com' });
    const response = await POST_CLAIM(new NextRequest('http://localhost/api/billing/public-checkout/claim', {
      method: 'POST', body: JSON.stringify({ token: checkoutToken }),
    }));
    expect(response.status).toBe(403);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
