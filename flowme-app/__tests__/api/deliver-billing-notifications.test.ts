import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/deliver-billing-notifications/route';

const mockClaim = jest.fn();
const mockDeliver = jest.fn();
const mockAdmin = { from: jest.fn() };

jest.mock('@/lib/api/admin', () => ({ getSupabaseAdmin: () => mockAdmin }));
jest.mock('@/lib/billing/notifications', () => ({
  claimBillingNotifications: (...args: unknown[]) => mockClaim(...args),
  deliverBillingNotification: (...args: unknown[]) => mockDeliver(...args),
}));

describe('billing notification delivery cron', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = 'cron-secret';
  });

  it('rejects unauthenticated delivery runs', async () => {
    const response = await GET(new NextRequest('http://localhost/api/cron/deliver-billing-notifications'));
    expect(response.status).toBe(401);
  });

  it('claims and delivers pending notifications', async () => {
    mockClaim.mockResolvedValue([{ id: 'n1', attempts: 0 }]);
    mockDeliver.mockResolvedValue({ status: 'sent' });
    const response = await GET(new NextRequest('http://localhost/api/cron/deliver-billing-notifications', {
      headers: { authorization: 'Bearer cron-secret' },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({ ok: true, claimed: 1 }));
    expect(mockDeliver).toHaveBeenCalled();
  });
});
