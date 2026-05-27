import {
  goalsDeletePlanTool,
  goalsListCalendarEventsTool,
  goalsRescheduleCalendarEventsTool,
  goalsRestoreCalendarEventsTool,
} from '@/lib/ai/tools/goals-tools';
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from '@/lib/google/google-calendar';

jest.mock('@/lib/google/google-calendar', () => ({
  createCalendarEvent: jest.fn().mockResolvedValue({ id: 'new-event-1', htmlLink: 'https://calendar.google.com/x', meetLink: null }),
  updateCalendarEvent: jest.fn().mockResolvedValue({ id: 'evt', htmlLink: 'https://calendar.google.com/x', meetLink: null }),
  deleteCalendarEvent: jest.fn().mockResolvedValue({ id: 'evt' }),
}));

const ACTIVE_EVENT = {
  id: 'link-1',
  provider_event_id: 'evt-1',
  linked_account_id: 'cal-1',
  action_plan_id: 'plan-1',
  goal_id: 'goal-1',
  title: 'Estudar Clean Architecture',
  scheduled_date: '2026-05-27',
  start_at: '2026-05-27T12:00:00.000Z',
  end_at: '2026-05-27T13:00:00.000Z',
  duration_minutes: 60,
  recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20261231T235959Z'],
  plan_day: null,
  sort_order: 0,
  status: 'active',
  deletion_source: null,
  deletion_note: null,
  deleted_at: null,
};

function makeContext(opts: { goalEvents?: any[]; goals?: any[] } = {}) {
  const calls: Operation[] = [];
  const goalEvents = opts.goalEvents ?? [];
  const goals = opts.goals ?? [];
  const supabase = {
    calls,
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const builder: any = {
        select(...args: unknown[]) { calls.push({ table, method: 'select', args }); return builder; },
        update(...args: unknown[]) { calls.push({ table, method: 'update', args }); return builder; },
        delete(...args: unknown[]) { calls.push({ table, method: 'delete', args }); return builder; },
        insert(...args: unknown[]) { calls.push({ table, method: 'insert', args }); return builder; },
        eq(key: string, value: unknown) { filters[key] = value; calls.push({ table, method: 'eq', args: [key, value] }); return builder; },
        in(key: string, value: unknown) { calls.push({ table, method: 'in', args: [key, value] }); return builder; },
        order(...args: unknown[]) { calls.push({ table, method: 'order', args }); return builder; },
        limit(...args: unknown[]) { calls.push({ table, method: 'limit', args }); return builder; },
        maybeSingle() {
          if (table === 'action_plans') return Promise.resolve({ data: { id: filters.id, title: 'Plan A' }, error: null });
          return Promise.resolve({ data: null, error: null });
        },
        then(resolve: Function, reject: Function) {
          let data: unknown[] = [];
          if (table === 'goal_calendar_events') data = goalEvents;
          else if (table === 'smart_goals') data = goals;
          else if (table === 'linked_accounts') data = [{ id: 'cal-1', name: 'victorrayansouzaramos@gmail.com', type: 'personal' }];
          else if (table === 'action_plans') data = [{ id: 'plan-1' }];
          else data = [];
          return Promise.resolve({ data, error: null }).then(resolve as any, reject as any);
        },
      };
      return builder;
    },
  };
  return { supabase, user: { id: 'user-1' }, timezone: 'America/Sao_Paulo', nowIso: '2026-05-26T12:00:00.000Z' } as any;
}

type Operation = { table: string; method: string; args: unknown[] };

beforeEach(() => jest.clearAllMocks());

describe('goals.list_calendar_events', () => {
  it('reports active and deleted events so Balys can explain removals', async () => {
    const context = makeContext({
      goalEvents: [ACTIVE_EVENT, { ...ACTIVE_EVENT, provider_event_id: 'evt-2', status: 'deleted', deleted_at: '2026-05-25T00:00:00.000Z' }],
    });

    const result = await goalsListCalendarEventsTool.call({ goal_id: 'goal-1', include_deleted: true, limit: 100 }, context);

    expect(result.ok).toBe(true);
    expect(result.receipt).toEqual(expect.objectContaining({ active_count: 1, deleted_count: 1 }));
  });
});

describe('goals.reschedule_calendar_events', () => {
  it('rejects calls with no change requested', async () => {
    const context = makeContext({ goalEvents: [ACTIVE_EVENT] });
    const result = await goalsRescheduleCalendarEventsTool.call({ goal_id: 'goal-1' }, context);
    expect(result.ok).toBe(false);
  });

  it('moves the time of day and rewrites the recurrence days for a goal', async () => {
    const context = makeContext({
      goalEvents: [ACTIVE_EVENT],
      goals: [{ id: 'goal-1', due_on: '2026-12-31', target_date: null }],
    });

    const result = await goalsRescheduleCalendarEventsTool.call({
      goal_id: 'goal-1',
      new_time: '21:00',
      new_recurrence_days: 'weekends',
    }, context);

    expect(result.ok).toBe(true);
    expect(result.receipt).toEqual(expect.objectContaining({ rescheduled_count: 1, failed_count: 0 }));

    const [, eventId, params] = (updateCalendarEvent as jest.Mock).mock.calls[0];
    expect(eventId).toBe('evt-1');
    expect(params.recurrence[0]).toContain('BYDAY=SU,SA');
    // 2026-05-27 is a Wednesday → first weekend day on/after is Saturday 2026-05-30
    expect(params.startAt).toContain('2026-05-30T21:00:00');
    expect((updateCalendarEvent as jest.Mock).mock.calls[0][3]).toBe(context);
  });

  it('reschedules specific events by provider id', async () => {
    const context = makeContext({ goalEvents: [ACTIVE_EVENT] });
    const result = await goalsRescheduleCalendarEventsTool.call({
      provider_event_ids: ['evt-1'],
      new_time: '07:30',
    }, context);

    expect(result.ok).toBe(true);
    expect(result.receipt).toEqual(expect.objectContaining({ rescheduled_count: 1 }));
    expect(updateCalendarEvent).toHaveBeenCalledTimes(1);
  });
});

describe('goals.restore_calendar_events', () => {
  it('recreates deleted events and flips the link back to active', async () => {
    const deleted = { ...ACTIVE_EVENT, provider_event_id: 'old-evt', status: 'deleted', deleted_at: '2026-05-25T00:00:00.000Z' };
    const context = makeContext({ goalEvents: [deleted] });

    const result = await goalsRestoreCalendarEventsTool.call({ goal_id: 'goal-1' }, context);

    expect(result.ok).toBe(true);
    expect(result.receipt).toEqual(expect.objectContaining({ restored_count: 1, failed_count: 0 }));
    expect(createCalendarEvent).toHaveBeenCalledWith('cal-1', expect.objectContaining({
      title: 'Estudar Clean Architecture',
      startAt: deleted.start_at,
      recurrence: deleted.recurrence,
    }), context);
    expect(context.supabase.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'goal_calendar_events', method: 'update' }),
    ]));
  });

  it('requires a selector', async () => {
    const context = makeContext({ goalEvents: [] });
    const result = await goalsRestoreCalendarEventsTool.call({}, context);
    expect(result.ok).toBe(false);
  });
});

describe('goals.delete_plan', () => {
  it('deletes a goal, its events, and reports the count', async () => {
    const context = makeContext({
      goalEvents: [ACTIVE_EVENT],
      goals: [{ id: 'goal-1', parent_goal_id: null, title: 'Atingir 10k' }],
    });

    const result = await goalsDeletePlanTool.call({ goal_id: 'goal-1', delete_calendar_events: true }, context);

    expect(result.ok).toBe(true);
    expect(result.receipt).toEqual(expect.objectContaining({ deleted_kind: 'goal', calendar_events_deleted: 1 }));
    expect(deleteCalendarEvent).toHaveBeenCalledWith('cal-1', 'evt-1', context);
    expect(context.supabase.calls.filter((c: Operation) => c.method === 'delete').map((c: Operation) => c.table)).toEqual(expect.arrayContaining([
      'smart_goals', 'action_plans',
    ]));
  });

  it('rejects passing both a goal and an action plan', async () => {
    const context = makeContext();
    const result = await goalsDeletePlanTool.call({ goal_id: 'goal-1', action_plan_id: 'plan-1', delete_calendar_events: true }, context);
    expect(result.ok).toBe(false);
  });

  it('can keep the calendar events when asked', async () => {
    const context = makeContext({
      goalEvents: [ACTIVE_EVENT],
      goals: [{ id: 'goal-1', parent_goal_id: null, title: 'Atingir 10k' }],
    });

    const result = await goalsDeletePlanTool.call({ goal_id: 'goal-1', delete_calendar_events: false }, context);

    expect(result.ok).toBe(true);
    expect(deleteCalendarEvent).not.toHaveBeenCalled();
    expect(result.receipt).toEqual(expect.objectContaining({ calendar_events_deleted: 0 }));
  });
});
