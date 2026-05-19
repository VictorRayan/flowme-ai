import { NextRequest } from 'next/server';
import { GET } from '@/app/api/tasks/day/route';

function makeChain(tableData: Record<string, unknown[]> = {}) {
  let currentTable = '';
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data: tableData[currentTable] || [], error: null }).then(resolve as any, reject as any);
    },
    catch(reject: Function) {
      return Promise.resolve({ data: tableData[currentTable] || [], error: null }).catch(reject as any);
    },
  };
  chain.from = jest.fn((table: string) => {
    currentTable = table;
    return chain;
  });
  const methods = ['select', 'eq', 'order', 'gte', 'lt', 'in'];
  methods.forEach(method => { chain[method] = jest.fn().mockReturnValue(chain); });
  return chain;
}

jest.mock('@/lib/google/google-calendar', () => ({
  getCalendarEvents: jest.fn().mockResolvedValue([{
    id: 'google-1',
    summary: 'Program Balys',
    description: null,
    start: { dateTime: '2026-05-02T10:00:00Z' },
    end: { dateTime: '2026-05-02T10:04:00Z' },
  }]),
}));

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() =>
    Promise.resolve({
      user: { id: 'user-1' },
      supabase: makeChain({
        linked_accounts: [{ id: 'account-1', name: 'Personal', type: 'calendar', provider: 'google' }],
      }),
    })
  ),
}));

describe('GET /api/tasks/day', () => {
  it('returns a day unit with normalized task nodes', async () => {
    const res = await GET(new NextRequest(
      'http://localhost/api/tasks/day?date=2026-05-02&timezone=America/Sao_Paulo'
    ));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.day.unit_id).toBe('day:2026-05-02');
    expect(body.day.tasks[0].task_id).toBe('calendar_event:google-1');
    expect(body.day.tasks[0].execution_type).toBe('event');
  });

  it('rejects invalid date', async () => {
    const res = await GET(new NextRequest('http://localhost/api/tasks/day?date=02-05-2026'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid timezone', async () => {
    const res = await GET(new NextRequest('http://localhost/api/tasks/day?date=2026-05-02&timezone=Nope/Nope'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
