import { persistGoalOperatingPlan } from '@/lib/goals/persist-plan';

type Operation = {
  table: string;
  method: string;
  args: unknown[];
};

function makeSupabaseMock(options: { failTaskInsert?: boolean } = {}) {
  const operations: Operation[] = [];
  let goalCounter = 0;

  const supabase = {
    operations,
    from(table: string) {
      let operation = '';
      const builder: any = {
        insert(...args: unknown[]) {
          operation = 'insert';
          operations.push({ table, method: 'insert', args });
          return builder;
        },
        delete(...args: unknown[]) {
          operation = 'delete';
          operations.push({ table, method: 'delete', args });
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
        single() {
          if (table === 'smart_goals') {
            goalCounter += 1;
            return Promise.resolve({
              data: { id: `goal-${goalCounter}`, title: `Goal ${goalCounter}`, timeframe: goalCounter === 1 ? 'yearly' : goalCounter === 2 ? 'monthly' : 'weekly' },
              error: null,
            });
          }
          if (table === 'action_plans') {
            return Promise.resolve({
              data: { id: 'plan-1', title: 'Action plan', plan_type: 'goal_plan', status: 'in_progress' },
              error: null,
            });
          }
          return Promise.resolve({ data: {}, error: null });
        },
        then(resolve: Function, reject: Function) {
          if (table === 'microactivities' && operation === 'insert' && options.failTaskInsert) {
            return Promise.resolve({ data: null, error: new Error('task insert failed') }).then(resolve as any, reject as any);
          }
          if (table === 'microactivities' && operation === 'insert') {
            return Promise.resolve({
              data: [{ id: 'task-1', title: 'Task', scheduled_date: '2026-05-02' }],
              error: null,
            }).then(resolve as any, reject as any);
          }
          return Promise.resolve({ data: [], error: null }).then(resolve as any, reject as any);
        },
      };
      return builder;
    },
  };

  return supabase;
}

const VALID_INPUT = {
  annual_smart_goal: 'Reach R$ 20k monthly revenue by December 2026',
  monthly_milestone: 'Close one new consulting client this month',
  weekly_routine: 'Prospect for 20 minutes daily',
  start_date: '2026-05-02',
  execution_window_days: 1,
};

describe('persistGoalOperatingPlan', () => {
  it('returns persisted records on success', async () => {
    const supabase = makeSupabaseMock();
    const result = await persistGoalOperatingPlan(supabase as any, 'user-1', VALID_INPUT);

    expect(result.persisted.goals.yearly.id).toBe('goal-1');
    expect(result.persisted.action_plan.id).toBe('plan-1');
    expect(result.persisted.tasks).toHaveLength(1);
  });

  it('cleans up goals, links, and action plan when task insertion fails', async () => {
    const supabase = makeSupabaseMock({ failTaskInsert: true });

    await expect(persistGoalOperatingPlan(supabase as any, 'user-1', VALID_INPUT)).rejects.toThrow('task insert failed');

    expect(supabase.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'action_plan_goal_links', method: 'delete' }),
      expect.objectContaining({ table: 'action_plans', method: 'delete' }),
      expect.objectContaining({ table: 'smart_goals', method: 'delete' }),
      expect.objectContaining({ table: 'smart_goals', method: 'in', args: ['id', ['goal-1', 'goal-2', 'goal-3']] }),
    ]));
  });
});
