import { NextRequest } from 'next/server';
import { POST } from '@/app/api/webhooks/stripe/route';

const mockConstructEvent = jest.fn();
const mockRetrieve = jest.fn();
const mockCreateClient = jest.fn();

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: mockRetrieve },
  })),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

function makeAwaitableChain(result = { error: null }) {
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve(result).then(resolve as any, reject as any);
    },
    catch(reject: Function) {
      return Promise.resolve(result).catch(reject as any);
    },
  };
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  return chain;
}

function makeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_123',
    customer: 'cus_123',
    status: 'active',
    cancel_at_period_end: false,
    metadata: { user_id: 'user-1' },
    current_period_start: 1780704000,
    current_period_end: 1783296000,
    items: { data: [{ price: { id: 'price_monthly' } }] },
    ...overrides,
  };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt_123',
    type: 'customer.subscription.updated',
    data: { object: makeSubscription() },
    ...overrides,
  };
}

describe('POST /api/webhooks/stripe', () => {
  const oldEnv = process.env;
  const mockBillingEventsInsert = jest.fn();
  const mockUserSubscriptionsUpsert = jest.fn();
  const mockUserEntitlementsUpsert = jest.fn();
  const billingEventsChain = makeAwaitableChain();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...oldEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.test',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_123',
      STRIPE_PRO_MONTHLY_PRICE_ID: 'price_monthly',
      STRIPE_PRO_ANNUAL_PRICE_ID: 'price_annual',
    };
    mockConstructEvent.mockReturnValue(makeEvent());
    mockBillingEventsInsert.mockResolvedValue({ error: null });
    mockUserSubscriptionsUpsert.mockResolvedValue({ error: null });
    mockUserEntitlementsUpsert.mockResolvedValue({ error: null });
    billingEventsChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    billingEventsChain.update.mockReturnValue(billingEventsChain);
    mockCreateClient.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'billing_events') {
          return {
            insert: mockBillingEventsInsert,
            select: billingEventsChain.select,
            eq: billingEventsChain.eq,
            update: billingEventsChain.update,
            maybeSingle: billingEventsChain.maybeSingle,
          };
        }
        if (table === 'user_subscriptions') {
          return { upsert: mockUserSubscriptionsUpsert };
        }
        if (table === 'user_entitlements') {
          return { upsert: mockUserEntitlementsUpsert };
        }
        return {};
      }),
    });
  });

  afterAll(() => {
    process.env = oldEnv;
  });

  it('records Stripe events as processed only after subscription and entitlements persist', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: 'raw-body',
      headers: { 'stripe-signature': 'sig_123' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(mockBillingEventsInsert).toHaveBeenCalledWith(expect.not.objectContaining({
      processed_at: expect.any(String),
    }));
    expect(mockUserSubscriptionsUpsert).toHaveBeenCalledWith(expect.objectContaining({
      provider_subscription_id: 'sub_123',
      plan_code: 'pro',
    }), { onConflict: 'billing_provider,provider_subscription_id' });
    expect(mockUserEntitlementsUpsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      has_pro: true,
    }), { onConflict: 'user_id' });
    expect(billingEventsChain.update).toHaveBeenCalledWith({
      processed_at: expect.any(String),
    });
  });

  it('reprocesses a duplicate Stripe event when it was not marked processed yet', async () => {
    mockBillingEventsInsert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } });
    billingEventsChain.maybeSingle.mockResolvedValue({ data: { processed_at: null }, error: null });

    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: 'raw-body',
      headers: { 'stripe-signature': 'sig_123' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(mockUserSubscriptionsUpsert).toHaveBeenCalled();
    expect(mockUserEntitlementsUpsert).toHaveBeenCalled();
    expect(billingEventsChain.update).toHaveBeenCalled();
  });
});
