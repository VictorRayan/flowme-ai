import { goalsCreateOperatingPlanTool, goalsCreateShortActionPlanTool, goalsListTool } from '@/lib/ai/tools/goals-tools';
import { persistGoalOperatingPlan } from '@/lib/goals/persist-plan';

jest.mock('@/lib/goals/persist-plan', () => ({
  persistGoalOperatingPlan: jest.fn().mockResolvedValue({
    plan: {
      active_tasks: [{ scheduled_date: '2026-05-02' }],
      action_plan: { review_date: '2026-05-09' },
      warnings: ['No preferred time provided.'],
    },
    persisted: {
      tasks: [{ id: 'task-1' }],
    },
  }),
}));

function makeContext() {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const supabase = {
    calls,
    from(table: string) {
      let operation = '';
      const builder: any = {
        select(...args: unknown[]) { calls.push({ table, method: 'select', args }); return builder; },
        insert(...args: unknown[]) { operation = 'insert'; calls.push({ table, method: 'insert', args }); return builder; },
        eq(...args: unknown[]) { calls.push({ table, method: 'eq', args }); return builder; },
        in(...args: unknown[]) { calls.push({ table, method: 'in', args }); return builder; },
        order(...args: unknown[]) { calls.push({ table, method: 'order', args }); return builder; },
        delete(...args: unknown[]) { operation = 'delete'; calls.push({ table, method: 'delete', args }); return builder; },
        single() {
          if (table === 'action_plans') {
            return Promise.resolve({ data: { id: 'plan-1', title: 'Sleep recovery', plan_type: 'short_term_problem' }, error: null });
          }
          return Promise.resolve({ data: {}, error: null });
        },
        then(resolve: Function, reject: Function) {
          if (table === 'smart_goals') return Promise.resolve({ data: [{ id: 'goal-1', title: 'Revenue goal' }], error: null }).then(resolve as any, reject as any);
          if (table === 'action_plans' && operation !== 'insert') return Promise.resolve({ data: [{ id: 'plan-1', title: 'Active plan' }], error: null }).then(resolve as any, reject as any);
          if (table === 'microactivities') return Promise.resolve({ data: [{ id: 'task-1', title: 'Sleep by eleven' }], error: null }).then(resolve as any, reject as any);
          return Promise.resolve({ data: [], error: null }).then(resolve as any, reject as any);
        },
      };
      return builder;
    },
  };

  return {
    supabase,
    user: { id: 'user-1' },
    timezone: 'America/Sao_Paulo',
    nowIso: '2026-05-02T12:00:00.000Z',
  } as any;
}

describe('goals tools', () => {
  it('lists goals and action plans', async () => {
    const context = makeContext();
    const result = await goalsListTool.call({ include_action_plans: true }, context);

    expect(result.ok).toBe(true);
    expect(result.receipt).toEqual(expect.objectContaining({
      goal_count: 1,
      action_plan_count: 1,
    }));
  });

  it('creates a long-term operating plan through the shared persistence helper', async () => {
    const context = makeContext();
    const result = await goalsCreateOperatingPlanTool.call({
      annual_smart_goal: 'Reach R$ 20k monthly revenue by December 2026',
      monthly_milestone: 'Close one consulting client this month',
      weekly_routine: 'Prospect for 20 minutes daily',
    }, context);

    expect(result.ok).toBe(true);
    expect(persistGoalOperatingPlan).toHaveBeenCalledWith(context.supabase, 'user-1', expect.objectContaining({
      annual_smart_goal: 'Reach R$ 20k monthly revenue by December 2026',
    }));
    expect(result.receipt).toEqual(expect.objectContaining({ goals_created: 3, tasks_created: 1 }));
  });

  it('creates a short-term action plan with flexible event-style tasks', async () => {
    const context = makeContext();
    const result = await goalsCreateShortActionPlanTool.call({
      title: 'Sleep recovery',
      problem_statement: 'I have slept poorly for three nights and need a reset plan.',
      linked_goal_ids: ['goal-1'],
      duration_days: 14,
      priority_label: 'negotiable',
      tasks: [
        { title: 'Lights out by eleven', duration_minutes: 30, priority_label: 'non_negotiable' },
      ],
    }, context);

    expect(result.ok).toBe(true);
    expect(result.receipt).toEqual(expect.objectContaining({
      tasks_created: 1,
      linked_goal_count: 1,
    }));
    expect((result.receipt as any).warnings[0]).toContain('flexible');
    expect(context.supabase.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'action_plans', method: 'insert' }),
      expect.objectContaining({ table: 'microactivities', method: 'insert' }),
    ]));
  });
});
