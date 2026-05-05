import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/action-plans/route';
import { PATCH, DELETE } from '@/app/api/action-plans/[id]/route';

const MOCK_PLAN = {
  id: 'plan-1',
  title: 'Revenue gap plan',
  plan_type: 'short_term_problem',
  status: 'not_started',
  linked_goal_ids: ['goal-1'],
};

function makeChain(listData: unknown[] = [MOCK_PLAN], singleData: unknown = MOCK_PLAN) {
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data: listData, error: null }).then(resolve as any, reject as any);
    },
    catch(reject: Function) {
      return Promise.resolve({ data: listData, error: null }).catch(reject as any);
    },
  };
  const methods = ['from', 'select', 'eq', 'or', 'order', 'insert', 'update', 'delete'];
  methods.forEach(method => { chain[method] = jest.fn().mockReturnValue(chain); });
  chain.single = jest.fn().mockResolvedValue({ data: singleData, error: null });
  return chain;
}

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() =>
    Promise.resolve({ user: { id: 'user-1' }, supabase: makeChain() })
  ),
}));

describe('/api/action-plans', () => {
  it('GET returns action plans', async () => {
    const res = await GET(new NextRequest('http://localhost/api/action-plans'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.action_plans)).toBe(true);
  });

  it('GET validates plan_type filter', async () => {
    const res = await GET(new NextRequest('http://localhost/api/action-plans?plan_type=bad'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST creates a standalone short-term action plan', async () => {
    const res = await POST(new NextRequest('http://localhost/api/action-plans', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Revenue gap plan',
        plan_type: 'short_term_problem',
        problem_statement: 'Compensation is below market.',
      }),
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.action_plan).toBeDefined();
  });

  it('POST accepts multiple linked goal ids', async () => {
    const res = await POST(new NextRequest('http://localhost/api/action-plans', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Sleep repair',
        plan_type: 'short_term_problem',
        linked_goal_ids: ['goal-1', 'goal-2'],
      }),
    }));

    expect(res.status).toBe(200);
  });

  it('POST validates required title', async () => {
    const res = await POST(new NextRequest('http://localhost/api/action-plans', {
      method: 'POST',
      body: JSON.stringify({ plan_type: 'goal_plan' }),
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('/api/action-plans/[id]', () => {
  it('PATCH updates a plan', async () => {
    const res = await PATCH(new NextRequest('http://localhost/api/action-plans/plan-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'in_progress', linked_goal_ids: ['goal-2'] }),
    }), { params: Promise.resolve({ id: 'plan-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('PATCH rejects empty body', async () => {
    const res = await PATCH(new NextRequest('http://localhost/api/action-plans/plan-1', {
      method: 'PATCH',
      body: JSON.stringify({}),
    }), { params: Promise.resolve({ id: 'plan-1' }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('DELETE returns deleted true', async () => {
    const res = await DELETE(new NextRequest('http://localhost/api/action-plans/plan-1', {
      method: 'DELETE',
    }), { params: Promise.resolve({ id: 'plan-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deleted).toBe(true);
  });
});
