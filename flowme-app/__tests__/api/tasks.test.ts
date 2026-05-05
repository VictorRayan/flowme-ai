import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/tasks/route';
import { PATCH, DELETE } from '@/app/api/tasks/[id]/route';
import { POST as MOVE } from '@/app/api/tasks/[id]/move/route';

const MOCK_TASK = {
  id: 'task-1',
  title: 'Write tests',
  category: 'negotiable',
  status: 'pending',
  priority: 0,
  scheduled_date: '2026-05-01',
  start_at: '2026-05-01T09:00:00Z',
};

function makeChain(listData: any[] = [MOCK_TASK], singleData: any = MOCK_TASK) {
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data: listData, error: null }).then(resolve as any, reject as any);
    },
    catch(reject: Function) {
      return Promise.resolve({ data: listData, error: null }).catch(reject as any);
    },
  };
  const methods = [
    'from', 'select', 'eq', 'order', 'limit',
    'insert', 'update', 'delete', 'upsert', 'gte', 'lte', 'in', 'or', 'contains',
  ];
  methods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
  chain.single = jest.fn().mockResolvedValue({ data: singleData, error: null });
  return chain;
}

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() =>
    Promise.resolve({ user: { id: 'user-1' }, supabase: makeChain() })
  ),
}));

describe('GET /api/tasks', () => {
  it('returns task list with ok:true', async () => {
    const req = new NextRequest('http://localhost/api/tasks');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.tasks)).toBe(true);
  });

  it('passes date filter when provided', async () => {
    const req = new NextRequest('http://localhost/api/tasks?date=2026-05-01');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe('POST /api/tasks', () => {
  it('creates a task and returns it', async () => {
    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Write tests', category: 'negotiable', scheduled_date: '2026-05-01' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.task).toBeDefined();
  });

  it('returns VALIDATION_ERROR when title is empty', async () => {
    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: '', category: 'negotiable' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR when title is missing', async () => {
    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ category: 'negotiable' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR for unknown category', async () => {
    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'My task', category: 'invalid_category' }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts goal operating system task metadata', async () => {
    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Practice negotiation',
        category: 'non_negotiable',
        outcome: 'pending',
        source_type: 'goal_task',
        duration_minutes: 15,
        linked_goal_id: 'goal-1',
        action_plan_id: 'plan-1',
        priority_source: 'balys',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/tasks/[id]', () => {
  it('updates task status to completed', async () => {
    const req = new NextRequest('http://localhost/api/tasks/task-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'task-1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('returns VALIDATION_ERROR when no fields provided', async () => {
    const req = new NextRequest('http://localhost/api/tasks/task-1', {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'task-1' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /api/tasks/[id]', () => {
  it('deletes a task and returns deleted:true', async () => {
    const req = new NextRequest('http://localhost/api/tasks/task-1', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'task-1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.deleted).toBe(true);
  });
});

describe('POST /api/tasks/[id]/move', () => {
  it('creates a new occurrence and marks the original as moved', async () => {
    const req = new NextRequest('http://localhost/api/tasks/task-1/move', {
      method: 'POST',
      body: JSON.stringify({ scheduled_date: '2026-05-03', outcome_reason: 'Moved from Today' }),
    });
    const res = await MOVE(req, { params: Promise.resolve({ id: 'task-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.moved).toBe(true);
    expect(body.new_task).toBeDefined();
  });

  it('rejects invalid move date', async () => {
    const req = new NextRequest('http://localhost/api/tasks/task-1/move', {
      method: 'POST',
      body: JSON.stringify({ scheduled_date: 'tomorrow' }),
    });
    const res = await MOVE(req, { params: Promise.resolve({ id: 'task-1' }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
