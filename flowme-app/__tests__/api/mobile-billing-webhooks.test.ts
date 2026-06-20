import { NextRequest } from 'next/server';
import { POST as appleWebhook } from '@/app/api/webhooks/apple/route';
import { POST as googleWebhook } from '@/app/api/webhooks/google-play/route';
import { verifyAndDecodeAppleJws } from '@/lib/billing/mobile-subscriptions';

const mockDecodeApple = verifyAndDecodeAppleJws as jest.MockedFunction<typeof verifyAndDecodeAppleJws>;
const mockInsert = jest.fn();
const mockMaybeSingle = jest.fn();

function chain() {
  const value: any = {};
  for (const method of ['select', 'eq', 'update']) value[method] = jest.fn().mockReturnValue(value);
  value.insert = mockInsert;
  value.maybeSingle = mockMaybeSingle;
  value.then = (resolve: Function, reject: Function) => Promise.resolve({ error: null }).then(resolve as any, reject as any);
  return value;
}

const mockAdmin = { from: jest.fn(() => chain()) };
jest.mock('@/lib/api/admin', () => ({ getSupabaseAdmin: jest.fn(() => mockAdmin) }));
jest.mock('@/lib/billing/admin-alerts', () => ({ recordBillingAdminAlert: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/billing/mobile-subscriptions', () => ({
  applyAppleNotificationState: jest.fn((subscription: unknown) => subscription),
  verifyAndDecodeAppleJws: jest.fn(),
  verifyAppleSubscription: jest.fn(() => ({ provider: 'apple' })),
  fetchGoogleSubscription: jest.fn(),
  syncVerifiedMobileSubscription: jest.fn().mockResolvedValue({}),
}));

describe('mobile billing webhooks', () => {
  const oldEnv = process.env;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...oldEnv, GOOGLE_PLAY_WEBHOOK_TOKEN: 'webhook-token' };
    mockInsert.mockResolvedValue({ error: null });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });
  afterAll(() => { process.env = oldEnv; });

  it('deduplicates Apple notifications by notification UUID', async () => {
    mockDecodeApple
      .mockReturnValueOnce({ notificationUUID: 'notification-1', notificationType: 'DID_RENEW', data: { signedTransactionInfo: 'transaction-jws' } })
      .mockReturnValueOnce({ transactionId: 'transaction-1', appAccountToken: 'user-1' });
    mockInsert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate' } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { processed_at: '2026-06-20T00:00:00.000Z' }, error: null });
    const response = await appleWebhook(new NextRequest('http://localhost/api/webhooks/apple', {
      method: 'POST', body: JSON.stringify({ signedPayload: 'notification-jws' }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, duplicate: true });
  });

  it('reprocesses an Apple duplicate that never finished processing', async () => {
    mockDecodeApple
      .mockReturnValueOnce({ notificationUUID: 'notification-1', notificationType: 'DID_RENEW', data: { signedTransactionInfo: 'transaction-jws' } })
      .mockReturnValueOnce({ transactionId: 'transaction-1', appAccountToken: 'user-1' });
    mockInsert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate' } });
    mockMaybeSingle.mockResolvedValueOnce({ data: { processed_at: null }, error: null });
    const response = await appleWebhook(new NextRequest('http://localhost/api/webhooks/apple', {
      method: 'POST', body: JSON.stringify({ signedPayload: 'notification-jws' }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('rejects Google Pub/Sub calls without the configured bearer token', async () => {
    const response = await googleWebhook(new NextRequest('http://localhost/api/webhooks/google-play', {
      method: 'POST', body: JSON.stringify({}),
    }));
    expect(response.status).toBe(401);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('accepts irrelevant authenticated Google notifications without changing access', async () => {
    const data = Buffer.from(JSON.stringify({ oneTimeProductNotification: {} })).toString('base64');
    const response = await googleWebhook(new NextRequest('http://localhost/api/webhooks/google-play', {
      method: 'POST', headers: { authorization: 'Bearer webhook-token' },
      body: JSON.stringify({ message: { messageId: 'message-1', data } }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, ignored: true });
  });
});
