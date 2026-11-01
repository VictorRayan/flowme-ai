import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { requireBillingAdmin, requireManagementRole } from '@/lib/billing/admin-auth';

jest.mock('@/lib/api/auth', () => ({ requireAuth: jest.fn() }));
jest.mock('@/lib/api/admin', () => ({ getSupabaseAdmin: jest.fn() }));

const authenticated = requireAuth as jest.Mock;
const adminClient = getSupabaseAdmin as jest.Mock;
const request = new NextRequest('http://localhost/api/admin/billing');

describe('admin tenant boundary', () => {
  const prior = process.env.BILLING_ADMIN_USER_IDS;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BILLING_ADMIN_USER_IDS = 'configured-admin';
    authenticated.mockResolvedValue({ user: { id: 'other-user', email: 'demo@example.com' } });
    adminClient.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ in: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }) });
  });

  afterAll(() => {
    if (prior === undefined) delete process.env.BILLING_ADMIN_USER_IDS;
    else process.env.BILLING_ADMIN_USER_IDS = prior;
  });

  it('does not treat an email address as an admin credential', async () => {
    await expect(requireBillingAdmin(request)).rejects.toThrow('FORBIDDEN');
    await expect(requireManagementRole(request, ['admin'])).rejects.toThrow('FORBIDDEN');
  });

  it('allows only the configured user ID', async () => {
    authenticated.mockResolvedValue({ user: { id: 'configured-admin', email: 'different@example.com' } });
    await expect(requireBillingAdmin(request)).resolves.toBeDefined();
  });
});
