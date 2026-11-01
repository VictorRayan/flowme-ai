import { NextRequest } from 'next/server';
import { POST } from '@/app/api/webhooks/stripe/route';

const mockConstructEvent = jest.fn();
const mockRetrieve = jest.fn();
const mockCreateClient = jest.fn();
const mockCreateBillingNotification = jest.fn();
const mockClearBillingFailureNotifications = jest.fn();
const mockRecordBillingAdminAlert = jest.fn();
const mockResolvePaymentFailureAdminAlerts = jest.fn();

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

jest.mock('@/lib/billing/notifications', () => ({
  createBillingNotification: (...args: unknown[]) => mockCreateBillingNotification(...args),
  clearBillingFailureNotifications: (...args: unknown[]) => mockClearBillingFailureNotifications(...args),
}));

jest.mock('@/lib/billing/admin-alerts', () => ({
  recordBillingAdminAlert: (...args: unknown[]) => mockRecordBillingAdminAlert(...args),
  resolvePaymentFailureAdminAlerts: (...args: unknown[]) => mockResolvePaymentFailureAdminAlerts(...args),
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
    items: { data: [{ price: { id: 'price_monthly' }, current_period_start: 1780704000, current_period_end: 1783296000 }] },
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
  const mockClaimEvent = jest.fn();
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
    mockClaimEvent.mockResolvedValue({ data: true, error: null });
    mockUserSubscriptionsUpsert.mockResolvedValue({ error: null });
    mockUserEntitlementsUpsert.mockResolvedValue({ error: null });
    mockCreateBillingNotification.mockResolvedValue({
      id: 'notification-1', userId: 'user-1', kind: 'payment_failed', provider: 'stripe',
    });
    mockClearBillingFailureNotifications.mockResolvedValue(undefined);
    mockRecordBillingAdminAlert.mockResolvedValue(undefined);
    mockResolvePaymentFailureAdminAlerts.mockResolvedValue(undefined);
    billingEventsChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    billingEventsChain.update.mockReturnValue(billingEventsChain);
    mockCreateClient.mockReturnValue({
      rpc: mockClaimEvent,
      from: jest.fn((table: string) => {
        if (table === 'billing_events') {
          return {
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

  it('does not grant Pro from an active subscription update without a paid invoice', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: 'raw-body',
      headers: { 'stripe-signature': 'sig_123' },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(mockClaimEvent).toHaveBeenCalledWith('claim_billing_event', expect.objectContaining({ p_provider: 'stripe', p_event_id: 'evt_123' }));
    expect(mockUserSubscriptionsUpsert).not.toHaveBeenCalled();
    expect(mockUserEntitlementsUpsert).not.toHaveBeenCalled();
    expect(billingEventsChain.update).toHaveBeenCalledWith({
      processed_at: expect.any(String),
    });
  });

  it('reprocesses a duplicate Stripe event when it was not marked processed yet', async () => {
    mockConstructEvent.mockReturnValue(makeEvent({
      id: 'evt_paid_retry',
      type: 'invoice.paid',
      data: { object: { id: 'in_123', customer: 'cus_123', subscription: 'sub_123' } },
    }));
    mockRetrieve.mockResolvedValue(makeSubscription());
    mockClaimEvent.mockResolvedValue({ data: true, error: null });

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

  it('does not repeat effects when the event is already claimed', async () => {
    mockClaimEvent.mockResolvedValue({ data: false, error: null });
    const response = await POST(new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST', body: 'raw-body', headers: { 'stripe-signature': 'sig_123' },
    }));
    expect(await response.json()).toEqual({ ok: true, duplicate: true });
    expect(mockUserSubscriptionsUpsert).not.toHaveBeenCalled();
  });

  it('persists subscription state and sends billing notifications on payment failure', async () => {
    mockConstructEvent.mockReturnValue(makeEvent({
      id: 'evt_failed',
      type: 'invoice.payment_failed',
      data: { object: { id: 'in_123', customer: 'cus_123', subscription: 'sub_123' } },
    }));
    mockRetrieve.mockResolvedValue(makeSubscription({ status: 'past_due' }));

    const res = await POST(new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST', body: 'raw-body', headers: { 'stripe-signature': 'sig_123' },
    }));

    expect(res.status).toBe(200);
    expect(mockUserSubscriptionsUpsert).toHaveBeenCalledWith(expect.objectContaining({ status: 'past_due' }), expect.anything());
    expect(mockCreateBillingNotification).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: 'user-1', kind: 'payment_failed', provider: 'stripe',
    }));
  });

  it('clears active payment alerts after a paid invoice', async () => {
    mockConstructEvent.mockReturnValue(makeEvent({
      id: 'evt_paid',
      type: 'invoice.paid',
      data: { object: { id: 'in_123', customer: 'cus_123', subscription: 'sub_123' } },
    }));
    mockRetrieve.mockResolvedValue(makeSubscription());

    const res = await POST(new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST', body: 'raw-body', headers: { 'stripe-signature': 'sig_123' },
    }));

    expect(res.status).toBe(200);
    expect(mockClearBillingFailureNotifications).toHaveBeenCalledWith(expect.anything(), 'user-1');
    expect(mockResolvePaymentFailureAdminAlerts).toHaveBeenCalledWith(expect.anything(), 'user-1');
  });
});
