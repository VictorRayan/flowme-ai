import { NextRequest } from 'next/server';
import { POST } from '@/app/api/v1/onboarding/complete/route';
import { persistGoalOperatingPlan } from '@/lib/goals/persist-plan';
import { createCalendarEvent } from '@/lib/google/google-calendar';
import { recordGoalCalendarEventLinks } from '@/lib/goals/calendar-event-links';

function makeChain() {
  let currentTable = '';
  const chain: any = {};
  const methods = ['select', 'eq', 'order', 'upsert'];
  methods.forEach(method => { chain[method] = jest.fn().mockReturnValue(chain); });
  chain.from = jest.fn((table: string) => {
    currentTable = table;
    return chain;
  });
  chain.then = (resolve: Function, reject: Function) =>
    Promise.resolve({
      data: currentTable === 'linked_accounts' ? [{ id: 'google-1' }] : null,
      error: null,
    }).then(resolve as any, reject as any);
  chain.single = jest.fn().mockImplementation(() => Promise.resolve({
    data: currentTable === 'financial_profiles' ? { user_id: 'user-1', default_currency: 'BRL' } : null,
    error: null,
  }));
  return chain;
}

jest.mock('@/lib/goals/persist-plan', () => ({
  persistGoalOperatingPlan: jest.fn().mockResolvedValue({
    plan: {
      active_tasks: [{ title: 'Prospect', description: 'Prospect daily', scheduled_date: '2026-05-19', start_at: null, end_at: null, duration_minutes: 20 }],
      recurring_events: [{
        title: 'Prospect',
        description: 'Prospect daily',
        scheduled_date: '2026-05-19',
        start_at: '2026-05-19T09:00:00.000Z',
        end_at: '2026-05-19T09:20:00.000Z',
        duration_minutes: 20,
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=SU,MO,TU,WE,TH,FR,SA;UNTIL=20261231T235959Z'],
      }],
    },
    persisted: { goals: { weekly: { id: 'goal-weekly' } }, action_plan: { id: 'plan-1' } },
  }),
}));

jest.mock('@/lib/google/google-calendar', () => ({
  createCalendarEvent: jest.fn().mockResolvedValue({ id: 'google-event-1', htmlLink: 'https://calendar.google.com/event', meetLink: null }),
}));

jest.mock('@/lib/goals/calendar-event-links', () => ({
  recordGoalCalendarEventLinks: jest.fn().mockResolvedValue({ inserted: 1 }),
}));

jest.mock('@/lib/api/auth', () => ({
  requireAuth: jest.fn().mockImplementation(() =>
    Promise.resolve({ user: { id: 'user-1' }, supabase: makeChain() })
  ),
}));

describe('POST /api/v1/onboarding/complete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (persistGoalOperatingPlan as jest.Mock).mockResolvedValue({
      plan: {
        active_tasks: [{ title: 'Prospect', description: 'Prospect daily', scheduled_date: '2026-05-19', start_at: null, end_at: null, duration_minutes: 20 }],
        recurring_events: [{
          title: 'Prospect',
          description: 'Prospect daily',
          scheduled_date: '2026-05-19',
          start_at: '2026-05-19T09:00:00.000Z',
          end_at: '2026-05-19T09:20:00.000Z',
          duration_minutes: 20,
          recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=SU,MO,TU,WE,TH,FR,SA;UNTIL=20261231T235959Z'],
        }],
      },
      persisted: { goals: { weekly: { id: 'goal-weekly' } }, action_plan: { id: 'plan-1' } },
    });
    (createCalendarEvent as jest.Mock).mockResolvedValue({ id: 'google-event-1', htmlLink: 'https://calendar.google.com/event', meetLink: null });
    (recordGoalCalendarEventLinks as jest.Mock).mockResolvedValue({ inserted: 1 });
  });

  it('saves rhythm settings and persists accepted goal proposals', async () => {
    const res = await POST(new NextRequest('http://localhost/api/v1/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify({
        morningTime: '08:00',
        eveningTime: '20:00',
        defaultCurrency: 'BRL',
        timezone: 'America/Sao_Paulo',
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
    expect(createCalendarEvent).toHaveBeenCalledWith(
      'google-1',
      expect.objectContaining({
        title: 'Prospect',
        timeZone: 'America/Sao_Paulo',
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=SU,MO,TU,WE,TH,FR,SA;UNTIL=20261231T235959Z'],
      }),
      expect.objectContaining({
        user: { id: 'user-1' },
        supabase: expect.anything(),
      }),
    );
    expect(body.calendar_events_created).toBe(1);
  });

  it('fails loudly when all expected Google Calendar events fail to create', async () => {
    (createCalendarEvent as jest.Mock).mockRejectedValueOnce(new Error('Google Calendar unavailable'));

    const res = await POST(new NextRequest('http://localhost/api/v1/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify({
        morningTime: '08:00',
        eveningTime: '20:00',
        goalProposals: [{
          annual_smart_goal: 'Reach R$ 20k monthly revenue by December',
          monthly_milestone: 'Close one client this month',
          weekly_routine: 'Prospect for 20 minutes daily',
          preferred_time: '09:00',
          default_task_duration_minutes: 20,
        }],
      }),
    }));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.error.message).toContain('Google Calendar events');
  });

  it('does not fail onboarding when event link recording fails after Google Calendar creation', async () => {
    (recordGoalCalendarEventLinks as jest.Mock).mockRejectedValueOnce(new Error('schema cache missing'));

    const res = await POST(new NextRequest('http://localhost/api/v1/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify({
        morningTime: '08:00',
        eveningTime: '20:00',
        timezone: 'America/Sao_Paulo',
        goalProposals: [{
          annual_smart_goal: 'Reach R$ 20k monthly revenue by December',
          monthly_milestone: 'Close one client this month',
          weekly_routine: 'Prospect for 20 minutes daily',
          preferred_time: '09:00',
          default_task_duration_minutes: 20,
        }],
      }),
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.calendar_events_created).toBe(1);
    expect(body.calendar_event_links_failed).toBe(1);
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

  it('rejects invalid default currency', async () => {
    const res = await POST(new NextRequest('http://localhost/api/v1/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify({ morningTime: '08:00', eveningTime: '20:00', defaultCurrency: 'BTC' }),
    }));
    expect(res.status).toBe(400);
  });
});
