import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/marketing-funnel/route';
import { requireManagementRole } from '@/lib/billing/admin-auth';

const mockRequireManagementRole = requireManagementRole as jest.MockedFunction<typeof requireManagementRole>;

function query(data: unknown[]) {
  const chain: any = {
    data,
    error: null,
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data, error: null }).then(resolve as any, reject as any);
    },
  };
  for (const method of ['select', 'gte', 'limit', 'order']) chain[method] = jest.fn().mockReturnValue(chain);
  return chain;
}

const mockAdmin = {
  from: jest.fn((table: string) => {
    if (table === 'marketing_page_visits') return query([
      { locale: 'pt-BR', surface: 'landing', occurred_at: '2026-06-28T10:00:00Z' },
      { locale: 'pt-BR', surface: 'checkout', occurred_at: '2026-06-28T10:05:00Z' },
      { locale: 'en-US', surface: 'landing', occurred_at: '2026-06-28T10:10:00Z' },
    ]);
    if (table === 'marketing_leads') return query([{ locale: 'pt-BR', created_at: '2026-06-28T10:01:00Z' }]);
    if (table === 'billing_checkout_attempts') return query([
      { id: 'a1', user_id: 'u1', locale: 'pt-BR', payment_method: 'pix', status: 'paid', amount_cents: 47880, provider: 'asaas', provider_payment_id: 'pay_1', metadata: {}, created_at: '2026-06-28T10:06:00Z' },
      { id: 'a2', user_id: 'u2', locale: 'en-US', payment_method: 'card', status: 'failed', amount_cents: 790, provider: 'stripe', provider_payment_id: null, metadata: { provider_error_message: 'card declined' }, created_at: '2026-06-28T10:07:00Z' },
    ]);
    if (table === 'billing_revenue_events') return query([{ kind: 'payment_received', amount_cents: 47880, occurred_at: '2026-06-28T10:08:00Z' }]);
    if (table === 'user_entitlements') return query([{ user_id: 'u1', has_pro: true }, { user_id: 'u2', has_pro: false }]);
    return query([{ user_id: 'u1', created_at: '2026-06-28T10:15:00Z' }]);
  }),
};

jest.mock('@/lib/api/admin', () => ({ getSupabaseAdmin: jest.fn(() => mockAdmin) }));
jest.mock('@/lib/billing/admin-auth', () => ({ requireManagementRole: jest.fn() }));

describe('GET /api/admin/marketing-funnel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireManagementRole.mockResolvedValue({ user: { id: 'admin-1' }, role: 'admin' } as never);
  });

  it('aggregates funnel metrics by locale', async () => {
    const response = await GET(new NextRequest('http://localhost/api/admin/marketing-funnel'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.funnel['pt-BR']).toEqual(expect.objectContaining({
      landing_visits: 1,
      mql: 1,
      checkout_visits: 1,
      sales: 1,
      pix_issued: 1,
      pix_paid: 1,
      revenue_cents: 47880,
    }));
    expect(body.funnel['en-US'].card_attempts).toBe(1);
    expect(body.card_attempts[0].error_message).toBe('card declined');
    expect(body.registered_users).toEqual({ total: 2, free: 1, paid: 1 });
  });
});
