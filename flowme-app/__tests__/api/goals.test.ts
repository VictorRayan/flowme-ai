import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/goals/route';
import { PATCH, DELETE } from '@/app/api/goals/[id]/route';

const MOCK_GOAL = {
  id: 'goal-1',
  title: 'Grow revenue',
  timeframe: 'yearly',
  status: 'not_started',
};

function makeChain(listData: unknown[] = [MOCK_GOAL], singleData: unknown = MOCK_GOAL) {
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data: listData, error: null }).then(resolve as any, reject as any);
    },
    catch(reject: Function) {
      return Promise.resolve({ data: listData, error: null }).catch(reject as any);
    },
  };
  const methods = ['from', 'select', 'eq', 'order', 'insert', 'update', 'delete'];
  methods.forEach(method => { chain[method] = jest.fn().mockReturnValue(chain); });
  chain.single = jest.fn().mockResolvedValue({ data: singleData, error: null });
  return chain;
}

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() =>
    Promise.resolve({ user: { id: 'user-1' }, supabase: makeChain() })
  ),
}));

describe('/api/goals', () => {
  it('GET returns goals', async () => {
    const res = await GET(new NextRequest('http://localhost/api/goals'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.goals)).toBe(true);
  });

  it('GET validates timeframe filter', async () => {
    const res = await GET(new NextRequest('http://localhost/api/goals?timeframe=decade'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST creates a goal', async () => {
    const res = await POST(new NextRequest('http://localhost/api/goals', {
      method: 'POST',
      body: JSON.stringify({ title: 'Grow revenue', timeframe: 'yearly' }),
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.goal).toBeDefined();
  });

  it('POST validates required title', async () => {
    const res = await POST(new NextRequest('http://localhost/api/goals', {
      method: 'POST',
      body: JSON.stringify({ timeframe: 'yearly' }),
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('/api/goals/[id]', () => {
  it('PATCH updates allowed fields', async () => {
    const res = await PATCH(new NextRequest('http://localhost/api/goals/goal-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'in_progress' }),
    }), { params: Promise.resolve({ id: 'goal-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('PATCH rejects empty body', async () => {
    const res = await PATCH(new NextRequest('http://localhost/api/goals/goal-1', {
      method: 'PATCH',
      body: JSON.stringify({}),
    }), { params: Promise.resolve({ id: 'goal-1' }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('DELETE returns deleted true', async () => {
    const res = await DELETE(new NextRequest('http://localhost/api/goals/goal-1', {
      method: 'DELETE',
    }), { params: Promise.resolve({ id: 'goal-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deleted).toBe(true);
  });
});
