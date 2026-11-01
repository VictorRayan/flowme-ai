import { NextRequest } from 'next/server';
import { POST } from '@/app/api/webhooks/asaas/route';

const mockFrom = jest.fn();
const mockClaimEvent = jest.fn();
const mockRecordAlert = jest.fn();
const mockClearNotifications = jest.fn();
const mockCreateNotification = jest.fn();

jest.mock('@/lib/api/admin', () => ({ getSupabaseAdmin: jest.fn(() => ({ from: mockFrom, rpc: mockClaimEvent })) }));
jest.mock('@/lib/billing/admin-alerts', () => ({ recordBillingAdminAlert: (...args: unknown[]) => mockRecordAlert(...args) }));
jest.mock('@/lib/billing/notifications', () => ({
  clearBillingFailureNotifications: (...args: unknown[]) => mockClearNotifications(...args),
  createBillingNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

function chain(result: { data?: unknown; error?: unknown } = { data: null, error: null }, single: unknown = null) {
  const value: Record<string, jest.Mock> = {};
  ['select', 'eq', 'order', 'limit', 'update', 'is'].forEach(method => value[method] = jest.fn().mockReturnValue(value));
  value.insert = jest.fn().mockResolvedValue(result);
  value.upsert = jest.fn().mockResolvedValue(result);
  value.maybeSingle = jest.fn().mockResolvedValue({ data: single, error: null });
  value.then = jest.fn((resolve: (input: unknown) => unknown) => Promise.resolve(result).then(resolve));
  return value;
}

describe('POST /api/webhooks/asaas', () => {
  const oldEnv = process.env;
  const events = chain();
  const attempts = chain({}, {
    id: 'attempt-1', user_id: 'user-1', plan_code: 'pro', billing_interval: 'monthly',
    provider_customer_id: 'cus_1', provider_subscription_id: 'sub_1', last_provider_event_at: null,
  });
  const subscriptions = chain();
  const entitlements = chain();

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-21T12:00:00Z'));
    jest.clearAllMocks();
    events.insert.mockResolvedValue({ data: null, error: null });
    mockClaimEvent.mockResolvedValue({ data: true, error: null });
    events.maybeSingle.mockResolvedValue({ data: null, error: null });
    process.env = { ...oldEnv, ASAAS_WEBHOOK_TOKEN: 'webhook-secret' };
    mockClearNotifications.mockResolvedValue(undefined);
    mockCreateNotification.mockResolvedValue({ id: 'notification-1' });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'billing_events') return events;
      if (table === 'billing_checkout_attempts') return attempts;
      if (table === 'user_subscriptions') return subscriptions;
      if (table === 'user_entitlements') return entitlements;
      return chain();
    });
  });

  afterEach(() => { jest.useRealTimers(); });
  afterAll(() => { process.env = oldEnv; });

  it('rejects an invalid webhook token', async () => {
    const response = await POST(new NextRequest('http://localhost/api/webhooks/asaas', {
      method: 'POST',
      headers: { 'asaas-access-token': 'wrong' },
      body: JSON.stringify({}),
    }));
    expect(response.status).toBe(401);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('activates Pro only after PAYMENT_RECEIVED', async () => {
    const response = await POST(new NextRequest('http://localhost/api/webhooks/asaas', {
      method: 'POST',
      headers: { 'asaas-access-token': 'webhook-secret' },
      body: JSON.stringify({
        id: 'evt_1', event: 'PAYMENT_RECEIVED', dateCreated: '2026-06-21T12:00:00Z',
        payment: { id: 'pay_1', customer: 'cus_1', subscription: 'sub_1', externalReference: 'attempt-1', paymentDate: '2026-06-21' },
      }),
    }));
    expect(response.status).toBe(200);
    expect(subscriptions.upsert).toHaveBeenCalledWith(expect.objectContaining({ status: 'active', billing_provider: 'asaas' }), expect.anything());
    expect(entitlements.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1', has_pro: true }), { onConflict: 'user_id' });
    expect(attempts.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'paid', provider_payment_id: 'pay_1' }));
  });

  it('acknowledges an already processed duplicate without repeating effects', async () => {
    mockClaimEvent.mockResolvedValue({ data: false, error: null });
    const response = await POST(new NextRequest('http://localhost/api/webhooks/asaas', {
      method: 'POST',
      headers: { 'asaas-access-token': 'webhook-secret' },
      body: JSON.stringify({ id: 'evt_1', event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1' } }),
    }));
    expect(await response.json()).toEqual({ ok: true, duplicate: true });
    expect(subscriptions.upsert).not.toHaveBeenCalled();
  });
});
