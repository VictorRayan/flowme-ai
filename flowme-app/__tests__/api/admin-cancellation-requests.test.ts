import { NextRequest } from 'next/server';
import { GET as listRequests } from '@/app/api/admin/cancellation-requests/route';
import { GET as getRequest, PATCH as updateRequest } from '@/app/api/admin/cancellation-requests/[id]/route';
import { POST as decideRequest } from '@/app/api/admin/cancellation-requests/[id]/decision/route';
import { POST as executeRequest } from '@/app/api/admin/cancellation-requests/[id]/execute/route';
import { getBillingGateway } from '@/lib/billing/providers/registry';

const cancellation = {
  id: 'cancel-1', user_id: 'user-1', subscription_id: 'sub-row-1', billing_provider: 'stripe', status: 'open',
  reason_code: 'price', reason: 'x'.repeat(120), disappointing_features: 'connectors', unmet_expectation: 'better support',
  would_accept_human_support: true, locale: 'pt-BR', provider_action_status: 'not_started', decision_reason: 'approved by manager',
};
const subscription = {
  id: 'sub-row-1', user_id: 'user-1', plan_code: 'pro', billing_provider: 'stripe', provider_subscription_id: 'sub_provider_1',
  status: 'active', current_period_start: '2026-06-01T00:00:00.000Z', current_period_end: '2026-07-01T00:00:00.000Z',
};
let cancellationStatus = 'open';

function chainFor(table: string) {
  let updatePayload: Record<string, unknown> | null = null;
  const chain: any = {
    then(resolve: Function, reject: Function) {
      const data = table === 'subscription_cancellation_requests' ? [{ ...cancellation, status: cancellationStatus }] : [];
      return Promise.resolve({ data, error: null }).then(resolve as never, reject as never);
    },
  };
  for (const method of ['select', 'eq', 'in', 'is', 'order', 'limit']) chain[method] = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn((payload: Record<string, unknown>) => { updatePayload = payload; if (typeof payload.status === 'string') cancellationStatus = payload.status; return chain; });
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.upsert = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn(async () => {
    if (table === 'user_subscriptions') return { data: subscription, error: null };
    return { data: { ...cancellation, status: cancellationStatus, ...(updatePayload || {}) }, error: null };
  });
  return chain;
}

const mockAdmin = { from: jest.fn((table: string) => chainFor(table)) };
const mockCancelSubscription = jest.fn();

jest.mock('@/lib/api/admin', () => ({ getSupabaseAdmin: jest.fn(() => mockAdmin) }));
jest.mock('@/lib/billing/admin-auth', () => ({ requireManagementRole: jest.fn().mockResolvedValue({ user: { id: 'manager-1' }, role: 'admin' }) }));
jest.mock('@/lib/billing/providers/registry', () => ({ getBillingGateway: jest.fn() }));

describe('cancellation management API', () => {
  beforeEach(() => {
    jest.clearAllMocks(); cancellationStatus = 'open';
    (getBillingGateway as jest.MockedFunction<typeof getBillingGateway>).mockReturnValue({ cancelSubscription: mockCancelSubscription } as never);
    mockCancelSubscription.mockResolvedValue({ provider: 'stripe', providerSubscriptionId: 'sub_provider_1', state: 'scheduled', effectiveAt: '2026-07-01T00:00:00.000Z' });
  });

  it('lists and reads full cancellation requests', async () => {
    const list = await listRequests(new NextRequest('http://localhost/api/admin/cancellation-requests'));
    expect(list.status).toBe(200);
    expect((await list.json()).requests).toHaveLength(1);
    const detail = await getRequest(new NextRequest('http://localhost/api/admin/cancellation-requests/cancel-1'), { params: Promise.resolve({ id: 'cancel-1' }) });
    expect(detail.status).toBe(200);
    expect((await detail.json()).request.reason).toHaveLength(120);
  });

  it('moves workflow state and records a justified decision', async () => {
    const update = await updateRequest(new NextRequest('http://localhost/api/admin/cancellation-requests/cancel-1', { method: 'PATCH', body: JSON.stringify({ status: 'in_review', admin_notes: 'Contato iniciado' }) }), { params: Promise.resolve({ id: 'cancel-1' }) });
    expect(update.status).toBe(200);
    const decision = await decideRequest(new NextRequest('http://localhost/api/admin/cancellation-requests/cancel-1/decision', { method: 'POST', body: JSON.stringify({ decision: 'approved_cancel', reason: 'Solicitação analisada e aprovada' }) }), { params: Promise.resolve({ id: 'cancel-1' }) });
    expect(decision.status).toBe(200);
    expect((await decision.json()).request.status).toBe('approved_cancel');
  });

  it('executes approved cancellation through the provider port', async () => {
    cancellationStatus = 'approved_cancel';
    const response = await executeRequest(new NextRequest('http://localhost/api/admin/cancellation-requests/cancel-1/execute', { method: 'POST', body: JSON.stringify({ mode: 'period_end' }) }), { params: Promise.resolve({ id: 'cancel-1' }) });
    expect(response.status).toBe(200);
    expect(mockCancelSubscription).toHaveBeenCalledWith(expect.objectContaining({ providerSubscriptionId: 'sub_provider_1', mode: 'period_end' }));
  });
});
