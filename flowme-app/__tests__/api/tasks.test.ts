import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/tasks/route';
import { PATCH, DELETE } from '@/app/api/tasks/[id]/route';
import { POST as MOVE } from '@/app/api/tasks/[id]/move/route';

const MOCK_TASK = {
  id: 'task-1',
  title: 'Write tests',
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
  it('rejects local task creation', async () => {
    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Write tests', scheduled_date: '2026-05-01' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.message).toContain('Google Calendar');
  });

  it('returns VALIDATION_ERROR when title is empty through the local creation shutdown', async () => {
    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: '' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns VALIDATION_ERROR when title is missing through the local creation shutdown', async () => {
    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects obsolete metadata through the local creation shutdown', async () => {
    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'My task', legacy_priority: 'urgent' }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(410);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects goal operating system task metadata because tasks must be calendar events', async () => {
    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Practice negotiation',
        outcome: 'pending',
        source_type: 'goal_task',
        duration_minutes: 15,
        linked_goal_id: 'goal-1',
        action_plan_id: 'plan-1',
        priority_source: 'balys',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(410);
  });
});

describe('PATCH /api/tasks/[id]', () => {
  it('rejects local task updates', async () => {
    const req = new NextRequest('http://localhost/api/tasks/task-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'task-1' }) });
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.message).toContain('Google Calendar');
  });

  it('rejects empty local task update through the shutdown', async () => {
    const req = new NextRequest('http://localhost/api/tasks/task-1', {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'task-1' }) });
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /api/tasks/[id]', () => {
  it('rejects local task deletion', async () => {
    const req = new NextRequest('http://localhost/api/tasks/task-1', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'task-1' }) });
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.message).toContain('Google Calendar');
  });
});

describe('POST /api/tasks/[id]/move', () => {
  it('rejects local task moves', async () => {
    const req = new NextRequest('http://localhost/api/tasks/task-1/move', {
      method: 'POST',
      body: JSON.stringify({ scheduled_date: '2026-05-03', outcome_reason: 'Moved from Today' }),
    });
    const res = await MOVE(req, { params: Promise.resolve({ id: 'task-1' }) });
    const body = await res.json();

    expect(res.status).toBe(410);
    expect(body.ok).toBe(false);
    expect(body.error.message).toContain('Google Calendar');
  });

  it('rejects invalid move date through the local move shutdown', async () => {
    const req = new NextRequest('http://localhost/api/tasks/task-1/move', {
      method: 'POST',
      body: JSON.stringify({ scheduled_date: 'tomorrow' }),
    });
    const res = await MOVE(req, { params: Promise.resolve({ id: 'task-1' }) });
    const body = await res.json();

    expect(res.status).toBe(410);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
