const mockGoogleGet = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    auth: { GoogleAuth: jest.fn() },
    androidpublisher: jest.fn(() => ({ purchases: { subscriptionsv2: { get: mockGoogleGet } } })),
  },
}));

import { applyAppleNotificationState, fetchGoogleSubscription, googleObfuscatedAccountId, verifyAndDecodeAppleJws } from '@/lib/billing/mobile-subscriptions';

describe('mobile subscription provider adapters', () => {
  const oldEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...oldEnv,
      GOOGLE_PLAY_PACKAGE_NAME: 'online.flowme.app',
      GOOGLE_PLAY_PRO_MONTHLY_PRODUCT_ID: 'flowme.pro.monthly',
      GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64: Buffer.from(JSON.stringify({ client_email: 'billing@test.local', private_key: 'key' })).toString('base64'),
    };
  });

  afterAll(() => { process.env = oldEnv; });

  it('creates a stable opaque account binding', () => {
    expect(googleObfuscatedAccountId('user-1')).toMatch(/^[a-f0-9]{64}$/);
    expect(googleObfuscatedAccountId('user-1')).toBe(googleObfuscatedAccountId('user-1'));
    expect(googleObfuscatedAccountId('user-1')).not.toBe(googleObfuscatedAccountId('user-2'));
  });

  it('maps a mocked Google grace-period response', async () => {
    mockGoogleGet.mockResolvedValue({ data: {
      latestOrderId: 'order-1',
      subscriptionState: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
      startTime: '2026-06-01T00:00:00Z',
      externalAccountIdentifiers: { obfuscatedExternalAccountId: googleObfuscatedAccountId('user-1') },
      lineItems: [{ productId: 'flowme.pro.monthly', expiryTime: '2026-07-01T00:00:00Z', autoRenewingPlan: { autoRenewEnabled: true } }],
    } });
    const result = await fetchGoogleSubscription('purchase-1', 'user-1');
    expect(result).toEqual(expect.objectContaining({
      provider: 'google', status: 'grace_period', purchaseToken: 'purchase-1',
      gracePeriodEndsAt: '2026-07-01T00:00:00Z',
    }));
    expect(mockGoogleGet).toHaveBeenCalledWith({ packageName: 'online.flowme.app', token: 'purchase-1' });
  });

  it('rejects a Google purchase linked to another account', async () => {
    mockGoogleGet.mockResolvedValue({ data: {
      subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
      externalAccountIdentifiers: { obfuscatedExternalAccountId: googleObfuscatedAccountId('user-2') },
      lineItems: [{ productId: 'flowme.pro.monthly' }],
    } });
    await expect(fetchGoogleSubscription('purchase-1', 'user-1')).rejects.toThrow('not linked to this user');
  });

  it('rejects malformed Apple signed payloads before reading transaction data', () => {
    expect(() => verifyAndDecodeAppleJws('not-a-jws')).toThrow('Invalid Apple signed payload');
  });

  it('maps Apple renewal failure and grace-period notifications', () => {
    const subscription = {
      provider: 'apple' as const, providerSubscriptionId: 'transaction-1', productId: 'pro', status: 'active' as const,
      currentPeriodStart: null, currentPeriodEnd: null, gracePeriodEndsAt: null, cancelAtPeriodEnd: false,
      userBinding: 'user-1', metadata: {},
    };
    expect(applyAppleNotificationState(subscription, 'DID_FAIL_TO_RENEW').status).toBe('past_due');
    expect(applyAppleNotificationState(subscription, 'DID_FAIL_TO_RENEW', 'GRACE_PERIOD').status).toBe('grace_period');
    expect(applyAppleNotificationState(subscription, 'GRACE_PERIOD_EXPIRED').status).toBe('expired');
  });
});
