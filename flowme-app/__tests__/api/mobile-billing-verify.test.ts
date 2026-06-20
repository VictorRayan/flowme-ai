import { NextRequest } from 'next/server';
import { POST as verifyApple } from '@/app/api/billing/apple/verify/route';
import { POST as verifyGoogle } from '@/app/api/billing/google/verify/route';
import { fetchGoogleSubscription, syncVerifiedMobileSubscription, verifyAppleSubscription } from '@/lib/billing/mobile-subscriptions';

const mockFetchGoogle = fetchGoogleSubscription as jest.MockedFunction<typeof fetchGoogleSubscription>;
const mockVerifyApple = verifyAppleSubscription as jest.MockedFunction<typeof verifyAppleSubscription>;
const mockSync = syncVerifiedMobileSubscription as jest.MockedFunction<typeof syncVerifiedMobileSubscription>;

jest.mock('@/lib/api/auth', () => ({ requireAuth: jest.fn().mockResolvedValue({ user: { id: 'user-1' }, supabase: {} }) }));
jest.mock('@/lib/api/admin', () => ({ getSupabaseAdmin: jest.fn(() => ({ from: jest.fn() })) }));
jest.mock('@/lib/billing/mobile-subscriptions', () => ({
  fetchGoogleSubscription: jest.fn(),
  verifyAppleSubscription: jest.fn(),
  syncVerifiedMobileSubscription: jest.fn(),
}));

const verified = {
  provider: 'apple' as const,
  providerSubscriptionId: 'transaction-1',
  productId: 'flowme.pro.monthly',
  status: 'active' as const,
  currentPeriodStart: null,
  currentPeriodEnd: '2026-07-20T00:00:00.000Z',
  gracePeriodEndsAt: null,
  cancelAtPeriodEnd: false,
  userBinding: 'user-1',
  metadata: {},
};

describe('mobile billing verification routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyApple.mockReturnValue(verified);
    mockFetchGoogle.mockResolvedValue({ ...verified, provider: 'google', purchaseToken: 'purchase-1' });
    mockSync.mockResolvedValue({ subscription: {}, entitlements: { plan_code: 'pro', has_pro: true } } as never);
  });

  it('verifies an Apple signed transaction for the authenticated user', async () => {
    const response = await verifyApple(new NextRequest('http://localhost/api/billing/apple/verify', {
      method: 'POST', body: JSON.stringify({ signed_transaction: 'signed-jws' }),
    }));
    expect(response.status).toBe(200);
    expect(mockVerifyApple).toHaveBeenCalledWith('signed-jws', 'user-1');
    expect(mockSync).toHaveBeenCalledWith(expect.anything(), 'user-1', verified);
  });

  it('verifies a Google purchase token against the provider', async () => {
    const response = await verifyGoogle(new NextRequest('http://localhost/api/billing/google/verify', {
      method: 'POST', body: JSON.stringify({ purchase_token: 'purchase-1' }),
    }));
    expect(response.status).toBe(200);
    expect(mockFetchGoogle).toHaveBeenCalledWith('purchase-1', 'user-1');
  });

  it.each([
    ['apple', verifyApple, {}],
    ['google', verifyGoogle, {}],
  ])('rejects a missing %s receipt', async (_provider, handler, body) => {
    const response = await handler(new NextRequest('http://localhost/api/billing/verify', {
      method: 'POST', body: JSON.stringify(body),
    }));
    expect(response.status).toBe(400);
  });
});
