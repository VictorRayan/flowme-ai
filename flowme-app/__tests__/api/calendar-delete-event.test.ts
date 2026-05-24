import { NextRequest } from 'next/server';
import { DELETE } from '@/app/api/calendar/delete-event/route';
import { deleteCalendarEvent } from '@/lib/google/google-calendar';

jest.mock('@/lib/google/google-calendar', () => ({
  deleteCalendarEvent: jest.fn().mockResolvedValue(undefined),
}));

function makeChain() {
  let currentTable = '';
  const rows: Record<string, unknown[]> = {
    linked_accounts: [{ id: 'account-1', is_active: true, is_deleted: false }],
    goal_calendar_events: [{
      id: 'link-1',
      provider_event_id: 'event-1',
      linked_account_id: 'account-1',
      action_plan_id: 'plan-1',
      goal_id: 'goal-weekly',
      title: 'Estudar Clean Architecture',
      scheduled_date: '2026-05-25',
      start_at: '2026-05-25T21:00:00.000Z',
      end_at: '2026-05-25T22:00:00.000Z',
      duration_minutes: 60,
      status: 'deleted',
    }],
  };
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data: rows[currentTable] || [], error: null }).then(resolve as any, reject as any);
    },
    catch(reject: Function) {
      return Promise.resolve({ data: [], error: null }).catch(reject as any);
    },
  };
  chain.from = jest.fn((table: string) => {
    currentTable = table;
    return chain;
  });
  const methods = ['select', 'eq', 'update'];
  methods.forEach(method => { chain[method] = jest.fn().mockReturnValue(chain); });
  chain.single = jest.fn(() => Promise.resolve({
    data: (rows[currentTable] || [])[0] || null,
    error: null,
  }));
  return chain;
}

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() =>
    Promise.resolve({ user: { id: 'user-1' }, supabase: makeChain() })
  ),
}));

describe('DELETE /api/calendar/delete-event', () => {
  it('deletes the Google event and marks linked goal events for replanning', async () => {
    const res = await DELETE(new NextRequest('http://localhost/api/calendar/delete-event', {
      method: 'DELETE',
      body: JSON.stringify({
        event_id: 'event-1',
        linked_account_id: 'account-1',
      }),
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(deleteCalendarEvent).toHaveBeenCalledWith('account-1', 'event-1');
    expect(body.goal_event_impact.needs_replan).toBe(true);
    expect(body.goal_event_impact.deleted_events[0].title).toBe('Estudar Clean Architecture');
  });
});
