import {
  deleteActionPlanRecords,
  deleteGoalRecords,
  gatherActionPlanDeletionTargets,
  gatherGoalDeletionTargets,
} from '@/lib/goals/delete-plan';

type Operation = { table: string; method: string; args: unknown[] };

function makeSupabase(tableData: Record<string, unknown[]> = {}) {
  const operations: Operation[] = [];
  const supabase = {
    operations,
    from(table: string) {
      const builder: any = {
        select(...args: unknown[]) { operations.push({ table, method: 'select', args }); return builder; },
        update(...args: unknown[]) { operations.push({ table, method: 'update', args }); return builder; },
        delete(...args: unknown[]) { operations.push({ table, method: 'delete', args }); return builder; },
        eq(...args: unknown[]) { operations.push({ table, method: 'eq', args }); return builder; },
        in(...args: unknown[]) { operations.push({ table, method: 'in', args }); return builder; },
        maybeSingle() {
          operations.push({ table, method: 'maybeSingle', args: [] });
          return Promise.resolve({ data: (tableData[table] || [])[0] ?? null, error: null });
        },
        then(resolve: Function, reject: Function) {
          return Promise.resolve({ data: tableData[table] || [], error: null }).then(resolve as any, reject as any);
        },
      };
      return builder;
    },
  };
  return supabase;
}

describe('goal/plan deletion targets', () => {
  it('gathers a goal, its sub-goals, linked plans and their calendar events', async () => {
    const supabase = makeSupabase({
      smart_goals: [
        { id: 'yearly', parent_goal_id: null, title: 'Atingir 10k' },
        { id: 'monthly', parent_goal_id: 'yearly', title: 'Primeiro cliente' },
        { id: 'weekly', parent_goal_id: 'monthly', title: 'Prospecção' },
      ],
      action_plans: [{ id: 'plan-1' }],
      action_plan_goal_links: [{ action_plan_id: 'plan-1' }],
      goal_calendar_events: [
        { linked_account_id: 'acc-1', provider_event_id: 'evt-1', title: 'Prospecção', status: 'active' },
      ],
    });

    const targets = await gatherGoalDeletionTargets(supabase as any, 'user-1', 'yearly');

    expect(targets.goal_ids).toEqual(expect.arrayContaining(['yearly', 'monthly', 'weekly']));
    expect(targets.action_plan_ids).toContain('plan-1');
    expect(targets.calendar_events.length).toBeGreaterThanOrEqual(1);
  });

  it('gathers an action plan and its calendar events', async () => {
    const supabase = makeSupabase({
      action_plans: [{ id: 'plan-1', title: 'Sprint landing page' }],
      goal_calendar_events: [
        { linked_account_id: 'acc-1', provider_event_id: 'evt-9', title: 'Landing', status: 'active' },
      ],
    });

    const targets = await gatherActionPlanDeletionTargets(supabase as any, 'user-1', 'plan-1');

    expect(targets.action_plan_id).toBe('plan-1');
    expect(targets.action_plan_title).toBe('Sprint landing page');
    expect(targets.calendar_events).toHaveLength(1);
  });

  it('deletes action plan records across all related tables', async () => {
    const supabase = makeSupabase();

    await deleteActionPlanRecords(supabase as any, 'user-1', ['plan-1']);

    const deletedTables = supabase.operations.filter(op => op.method === 'delete').map(op => op.table);
    expect(deletedTables).toEqual(expect.arrayContaining([
      'goal_calendar_events', 'action_plan_tasks', 'action_plan_goal_links', 'action_plans',
    ]));
  });

  it('unlinks goal parents before deleting the goals to avoid FK errors', async () => {
    const supabase = makeSupabase();

    await deleteGoalRecords(supabase as any, 'user-1', {
      goal_ids: ['yearly', 'monthly', 'weekly'],
      goal_titles: ['Atingir 10k'],
      action_plan_ids: ['plan-1'],
      calendar_events: [],
    });

    const smartGoalOps = supabase.operations.filter(op => op.table === 'smart_goals');
    const updateIndex = smartGoalOps.findIndex(op => op.method === 'update');
    const deleteIndex = smartGoalOps.findIndex(op => op.method === 'delete');
    expect(updateIndex).toBeGreaterThanOrEqual(0);
    expect(deleteIndex).toBeGreaterThan(updateIndex);
  });
});
