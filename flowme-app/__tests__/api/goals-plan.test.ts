import { NextRequest } from 'next/server';
import { POST } from '@/app/api/goals/plan/route';
import { createCalendarEvent } from '@/lib/google/google-calendar';

const tableRows: Record<string, unknown> = {
  smart_goals: { id: 'goal-1', title: 'Goal', timeframe: 'yearly', status: 'in_progress' },
  action_plans: { id: 'plan-1', title: 'Action plan', plan_type: 'goal_plan', status: 'in_progress' },
  action_plan_goal_links: [{ id: 'link-1' }],
  linked_accounts: { id: 'google-1', is_active: true, is_deleted: false },
};

jest.mock('@/lib/google/google-calendar', () => ({
  createCalendarEvent: jest.fn().mockResolvedValue({ id: 'google-event-1', htmlLink: 'https://calendar.google.com/event', meetLink: null }),
}));

function makeChain() {
  let currentTable = '';
  const chain: any = {
    then(resolve: Function, reject: Function) {
      const data = currentTable === 'action_plan_goal_links'
        ? tableRows[currentTable] || []
        : [tableRows[currentTable] || {}];
      return Promise.resolve({ data, error: null }).then(resolve as any, reject as any);
    },
    catch(reject: Function) {
      return Promise.resolve({ data: [], error: null }).catch(reject as any);
    },
  };
  chain.from = jest.fn((table: string) => {
    currentTable = table;
    return chain;
  });
  const methods = ['insert', 'select', 'eq', 'delete', 'upsert'];
  methods.forEach(method => { chain[method] = jest.fn().mockReturnValue(chain); });
  chain.single = jest.fn(() => Promise.resolve({
    data: tableRows[currentTable] || {},
    error: null,
  }));
  return chain;
}

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() =>
    Promise.resolve({ user: { id: 'user-1' }, supabase: makeChain() })
  ),
}));

describe('POST /api/goals/plan', () => {
  it('persists an accepted goal proposal into goals, plan, and full-period events', async () => {
    const res = await POST(new NextRequest('http://localhost/api/goals/plan', {
      method: 'POST',
      body: JSON.stringify({
        annual_smart_goal: 'Reach R$ 20k monthly revenue by December 2026',
        monthly_milestone: 'Close one new consulting client this month',
        weekly_routine: 'Prospect for 20 minutes daily',
        linked_account_id: 'google-1',
        start_date: '2026-05-02',
        target_date: '2026-05-05',
        execution_window_days: 4,
      }),
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.plan.goals).toHaveLength(3);
    expect(body.plan.active_tasks).toHaveLength(4);
    expect(body.persisted.action_plan).toBeDefined();
    expect(body.calendar_events).toHaveLength(1);
    expect(createCalendarEvent).toHaveBeenCalledWith('google-1', expect.objectContaining({
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=SU,MO,TU,WE,TH,FR,SA;UNTIL=20260505T235959Z'],
    }));
  });

  it('returns validation error for incomplete proposal', async () => {
    const res = await POST(new NextRequest('http://localhost/api/goals/plan', {
      method: 'POST',
      body: JSON.stringify({
        annual_smart_goal: '',
        monthly_milestone: 'Close one new client',
        weekly_routine: 'Prospect daily',
        linked_account_id: 'google-1',
      }),
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
