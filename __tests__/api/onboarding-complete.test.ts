import { NextRequest } from 'next/server';
import { POST } from '@/app/api/v1/onboarding/complete/route';
import { persistGoalOperatingPlan } from '@/lib/goals/persist-plan';

function makeChain() {
  const chain: any = {};
  const methods = ['from', 'upsert'];
  methods.forEach(method => { chain[method] = jest.fn().mockReturnValue(chain); });
  chain.then = (resolve: Function, reject: Function) =>
    Promise.resolve({ data: null, error: null }).then(resolve as any, reject as any);
  return chain;
}

jest.mock('@/lib/goals/persist-plan', () => ({
  persistGoalOperatingPlan: jest.fn().mockResolvedValue({ persisted: { goals: {} } }),
}));

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() =>
    Promise.resolve({ user: { id: 'user-1' }, supabase: makeChain() })
  ),
}));

describe('POST /api/v1/onboarding/complete', () => {
  it('saves rhythm settings and persists accepted goal proposals', async () => {
    const res = await POST(new NextRequest('http://localhost/api/v1/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify({
        morningTime: '08:00',
        eveningTime: '20:00',
        goalProposals: [{
          annual_smart_goal: 'Reach R$ 20k monthly revenue by December',
          monthly_milestone: 'Close one client this month',
          weekly_routine: 'Prospect for 20 minutes daily',
        }],
      }),
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.created_plan_count).toBe(1);
    expect(persistGoalOperatingPlan).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      expect.objectContaining({
        annual_smart_goal: 'Reach R$ 20k monthly revenue by December',
      })
    );
    expect((persistGoalOperatingPlan as jest.Mock).mock.calls[0][2].preferred_time).toBeUndefined();
  });

  it('requires rhythm times', async () => {
    const res = await POST(new NextRequest('http://localhost/api/v1/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify({ morningTime: '08:00' }),
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
