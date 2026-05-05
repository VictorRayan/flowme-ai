import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/events/route';
import { PATCH, DELETE } from '@/app/api/events/[id]/route';

const MOCK_EVENT = {
  id: 'event-1',
  title: 'Write plan',
  description: null,
  start_at: '2026-05-02T09:00:00Z',
  end_at: null,
  scheduled_date: '2026-05-02',
  source_type: 'manual',
};

function makeChain(listData: any[] = [MOCK_EVENT], singleData: any = MOCK_EVENT) {
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data: listData, error: null }).then(resolve as any, reject as any);
    },
    catch(reject: Function) {
      return Promise.resolve({ data: listData, error: null }).catch(reject as any);
    },
  };
  const methods = ['from', 'select', 'eq', 'gte', 'lt', 'order', 'insert', 'update', 'delete'];
  methods.forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
  chain.single = jest.fn().mockResolvedValue({ data: singleData, error: null });
  return chain;
}

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() =>
    Promise.resolve({ user: { id: 'user-1' }, supabase: makeChain() })
  ),
}));

describe('/api/events', () => {
  it('GET returns Flowme events for a date range', async () => {
    const req = new NextRequest('http://localhost/api/events?start=2026-05-02T00:00:00Z&end=2026-05-03T00:00:00Z');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.events[0].title).toBe('Write plan');
  });

  it('GET rejects missing range', async () => {
    const req = new NextRequest('http://localhost/api/events');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST creates a flexible Flowme event', async () => {
    const req = new NextRequest('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({ title: 'Stretch', scheduled_date: '2026-05-02', duration_minutes: 5 }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.event.title).toBe('Write plan');
  });

  it('POST rejects missing title', async () => {
    const req = new NextRequest('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({ scheduled_date: '2026-05-02' }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST rejects invalid priority label', async () => {
    const req = new NextRequest('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({ title: 'Stretch', scheduled_date: '2026-05-02', priority_label: 'urgent' }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PATCH updates an event', async () => {
    const req = new NextRequest('http://localhost/api/events/event-1', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated plan' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'event-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.event).toBeDefined();
  });

  it('PATCH rejects empty body', async () => {
    const req = new NextRequest('http://localhost/api/events/event-1', {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'event-1' }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('DELETE returns deleted true', async () => {
    const req = new NextRequest('http://localhost/api/events/event-1', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'event-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.deleted).toBe(true);
  });
});
