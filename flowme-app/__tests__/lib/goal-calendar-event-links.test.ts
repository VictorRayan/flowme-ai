import {
  listDeletedGoalCalendarEvents,
  listGoalCalendarEvents,
  markGoalCalendarEventDeleted,
  recordGoalCalendarEventLinks,
  restoreGoalCalendarEvent,
  updateGoalCalendarEventSchedule,
} from '@/lib/goals/calendar-event-links';

type Operation = {
  table: string;
  method: string;
  args: unknown[];
};

function makeSupabaseMock(rows: unknown[] = []) {
  const operations: Operation[] = [];
  const supabase = {
    operations,
    from(table: string) {
      const builder: any = {
        upsert(...args: unknown[]) {
          operations.push({ table, method: 'upsert', args });
          return Promise.resolve({ data: null, error: null });
        },
        update(...args: unknown[]) {
          operations.push({ table, method: 'update', args });
          return builder;
        },
        select(...args: unknown[]) {
          operations.push({ table, method: 'select', args });
          return builder;
        },
        eq(...args: unknown[]) {
          operations.push({ table, method: 'eq', args });
          return builder;
        },
        in(...args: unknown[]) {
          operations.push({ table, method: 'in', args });
          return builder;
        },
        order(...args: unknown[]) {
          operations.push({ table, method: 'order', args });
          return builder;
        },
        limit(...args: unknown[]) {
          operations.push({ table, method: 'limit', args });
          return builder;
        },
        then(resolve: Function, reject: Function) {
          return Promise.resolve({ data: rows, error: null }).then(resolve as any, reject as any);
        },
      };
      return builder;
    },
  };
  return supabase;
}

describe('goal calendar event links', () => {
  it('records provider events against the action plan and weekly goal', async () => {
    const supabase = makeSupabaseMock();

    await recordGoalCalendarEventLinks(supabase as any, 'user-1', [{
      linked_account_id: 'account-1',
      provider_event_id: 'event-1',
      action_plan_id: 'plan-1',
      goal_id: 'goal-weekly',
      title: 'Estudar Clean Architecture',
      scheduled_date: '2026-05-25',
      start_at: '2026-05-25T21:00:00.000Z',
      end_at: '2026-05-25T22:00:00.000Z',
      duration_minutes: 60,
      plan_day: 1,
      sort_order: 0,
    }]);

    expect(supabase.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'goal_calendar_events', method: 'upsert' }),
    ]));
    expect(supabase.operations[0].args[0]).toEqual([expect.objectContaining({
      user_id: 'user-1',
      provider_event_id: 'event-1',
      action_plan_id: 'plan-1',
      goal_id: 'goal-weekly',
      status: 'active',
    })]);
  });

  it('marks a deleted calendar event as needing replan when it belongs to a goal', async () => {
    const supabase = makeSupabaseMock([{
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
    }]);

    const result = await markGoalCalendarEventDeleted(supabase as any, 'user-1', {
      linkedAccountId: 'account-1',
      providerEventId: 'event-1',
      deletionSource: 'balys',
      deletionNote: 'User cancelled from chat',
    });

    expect(result.needs_replan).toBe(true);
    expect(result.matched).toBe(1);
    expect(supabase.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'goal_calendar_events', method: 'eq', args: ['provider_event_id', 'event-1'] }),
    ]));
  });

  it('lists deleted goal events in scheduled order for Balys', async () => {
    const supabase = makeSupabaseMock([{ id: 'link-1', title: 'Prospectar clientes' }]);

    const rows = await listDeletedGoalCalendarEvents(supabase as any, 'user-1', 10);

    expect(rows).toHaveLength(1);
    expect(supabase.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'goal_calendar_events', method: 'eq', args: ['status', 'deleted'] }),
      expect.objectContaining({ table: 'goal_calendar_events', method: 'limit', args: [10] }),
    ]));
  });

  it('records the recurrence so it can be restored or remanaged later', async () => {
    const supabase = makeSupabaseMock();

    await recordGoalCalendarEventLinks(supabase as any, 'user-1', [{
      linked_account_id: 'account-1',
      provider_event_id: 'event-1',
      action_plan_id: 'plan-1',
      goal_id: 'goal-weekly',
      title: 'Estudar Clean Architecture',
      scheduled_date: '2026-05-25',
      start_at: '2026-05-25T21:00:00.000Z',
      end_at: '2026-05-25T22:00:00.000Z',
      duration_minutes: 60,
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
    }]);

    expect((supabase.operations[0].args[0] as any[])[0]).toEqual(expect.objectContaining({
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
    }));
  });

  it('filters goal calendar events by goal and status when remanaging', async () => {
    const supabase = makeSupabaseMock([{ id: 'link-1', title: 'Estudar', status: 'active' }]);

    const rows = await listGoalCalendarEvents(supabase as any, 'user-1', {
      goalId: 'goal-weekly',
      statuses: ['active', 'rescheduled'],
    });

    expect(rows).toHaveLength(1);
    expect(supabase.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'goal_calendar_events', method: 'eq', args: ['goal_id', 'goal-weekly'] }),
      expect.objectContaining({ table: 'goal_calendar_events', method: 'in', args: ['status', ['active', 'rescheduled']] }),
    ]));
  });

  it('syncs the link row when an event is rescheduled', async () => {
    const supabase = makeSupabaseMock();

    await updateGoalCalendarEventSchedule(supabase as any, 'user-1', {
      linkedAccountId: 'account-1',
      providerEventId: 'event-1',
      startAt: '2026-05-30T00:00:00.000Z',
      endAt: '2026-05-30T01:00:00.000Z',
      scheduledDate: '2026-05-30',
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=SA,SU'],
    });

    const update = supabase.operations.find(op => op.method === 'update');
    expect((update?.args[0] as any)).toEqual(expect.objectContaining({
      status: 'rescheduled',
      scheduled_date: '2026-05-30',
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=SA,SU'],
    }));
    expect(supabase.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'goal_calendar_events', method: 'eq', args: ['provider_event_id', 'event-1'] }),
    ]));
  });

  it('flips a deleted event back to active on restore with the new provider id', async () => {
    const supabase = makeSupabaseMock();

    await restoreGoalCalendarEvent(supabase as any, 'user-1', {
      linkedAccountId: 'account-1',
      oldProviderEventId: 'old-event',
      newProviderEventId: 'new-event',
      startAt: '2026-05-25T21:00:00.000Z',
      endAt: '2026-05-25T22:00:00.000Z',
      scheduledDate: '2026-05-25',
    });

    const update = supabase.operations.find(op => op.method === 'update');
    expect((update?.args[0] as any)).toEqual(expect.objectContaining({
      status: 'active',
      provider_event_id: 'new-event',
      rescheduled_provider_event_id: 'old-event',
      deleted_at: null,
    }));
    expect(supabase.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'goal_calendar_events', method: 'eq', args: ['provider_event_id', 'old-event'] }),
    ]));
  });
});
