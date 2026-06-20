import { NextRequest } from 'next/server';
import { GET, PATCH } from '@/app/api/admin/billing/route';
import { requireBillingAdmin } from '@/lib/billing/admin-auth';

const mockRequireAdmin = requireBillingAdmin as jest.MockedFunction<typeof requireBillingAdmin>;

function query(data: unknown[]) {
  const value: any = {
    data,
    error: null,
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data, error: null }).then(resolve as any, reject as any);
    },
  };
  for (const method of ['select', 'order', 'limit', 'gte']) value[method] = jest.fn().mockReturnValue(value);
  return value;
}

const mockUpdateSingle = jest.fn();
const mockUpdateEq = jest.fn(() => ({ select: jest.fn(() => ({ single: mockUpdateSingle })) }));
const mockUpdate = jest.fn(() => ({ eq: mockUpdateEq }));
const mockAdmin = {
  from: jest.fn((table: string) => {
    if (table === 'billing_admin_alerts') return query([{ id: 'alert-1', kind: 'webhook_failure' }]);
    if (table === 'billing_reconciliation_runs') return query([{ id: 'run-1', status: 'completed' }]);
    if (table === 'subscription_cancellation_requests') return { ...query([{ id: 'cancel-1', status: 'open' }]), update: mockUpdate };
    return query([{ user_id: 'user-1', cost_usd: 1.25 }, { user_id: 'user-1', cost_usd: 2 }]);
  }),
};

jest.mock('@/lib/api/admin', () => ({ getSupabaseAdmin: jest.fn(() => mockAdmin) }));
jest.mock('@/lib/billing/admin-auth', () => ({ requireBillingAdmin: jest.fn() }));

describe('GET /api/admin/billing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ user: { id: 'admin-1' } } as never);
    mockUpdateSingle.mockResolvedValue({ data: { id: 'cancel-1', status: 'in_review', admin_notes: 'Contato iniciado' }, error: null });
  });

  it('returns operational data and aggregated AI cost for an allowlisted admin', async () => {
    const response = await GET(new NextRequest('http://localhost/api/admin/billing'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.alerts).toHaveLength(1);
    expect(body.runs).toHaveLength(1);
    expect(body.cancellation_requests).toHaveLength(1);
    expect(body.ai_costs).toEqual([{ user_id: 'user-1', cost_usd: 3.25 }]);
  });

  it('returns 403 when the user is not in the billing admin allowlist', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('FORBIDDEN'));
    const response = await GET(new NextRequest('http://localhost/api/admin/billing'));
    expect(response.status).toBe(403);
  });

  it('updates cancellation status and internal notes', async () => {
    const response = await PATCH(new NextRequest('http://localhost/api/admin/billing', {
      method: 'PATCH', body: JSON.stringify({ request_id: 'cancel-1', status: 'in_review', admin_notes: 'Contato iniciado' }),
    }));
    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'in_review', admin_notes: 'Contato iniciado', assigned_to: 'admin-1',
    }));
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'cancel-1');
  });

  it('rejects an invalid cancellation status', async () => {
    const response = await PATCH(new NextRequest('http://localhost/api/admin/billing', {
      method: 'PATCH', body: JSON.stringify({ request_id: 'cancel-1', status: 'invalid' }),
    }));
    expect(response.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
