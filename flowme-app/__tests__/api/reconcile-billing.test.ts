import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/reconcile-billing/route';
import { createHighAiCostAlerts, reconcileBilling } from '@/lib/billing/reconciliation';

const mockReconcile = reconcileBilling as jest.MockedFunction<typeof reconcileBilling>;
const mockCosts = createHighAiCostAlerts as jest.MockedFunction<typeof createHighAiCostAlerts>;

jest.mock('@/lib/api/admin', () => ({ getSupabaseAdmin: jest.fn(() => ({})) }));
jest.mock('@/lib/billing/reconciliation', () => ({ reconcileBilling: jest.fn(), createHighAiCostAlerts: jest.fn() }));
jest.mock('@/lib/billing/ai-guardrails', () => ({ cleanupAiGuardHistory: jest.fn().mockResolvedValue(undefined) }));

describe('GET /api/cron/reconcile-billing', () => {
  const oldEnv = process.env;
  beforeEach(() => {
    process.env = { ...oldEnv, CRON_SECRET: 'cron-secret' };
    mockReconcile.mockResolvedValue({ inspected: 3, matched: 2, repaired: 1, mismatched: 1 });
    mockCosts.mockResolvedValue({ inspected_users: 2, alerts: 1 });
  });
  afterAll(() => { process.env = oldEnv; });

  it('requires the cron bearer token', async () => {
    const response = await GET(new NextRequest('http://localhost/api/cron/reconcile-billing'));
    expect(response.status).toBe(401);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('runs provider reconciliation and AI cost checks together', async () => {
    const response = await GET(new NextRequest('http://localhost/api/cron/reconcile-billing', {
      headers: { authorization: 'Bearer cron-secret' },
    }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      reconciliation: { inspected: 3, matched: 2, repaired: 1, mismatched: 1 },
      ai_cost: { inspected_users: 2, alerts: 1 },
    });
  });
});
