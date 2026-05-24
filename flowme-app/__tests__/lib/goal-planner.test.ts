import { buildGoalOperatingPlan } from '@/lib/goals/planner';

describe('buildGoalOperatingPlan', () => {
  it('creates yearly, monthly, and weekly goal records from an accepted proposal', () => {
    const plan = buildGoalOperatingPlan({
      annual_smart_goal: 'Reach R$ 20k monthly revenue by December 2026',
      monthly_milestone: 'Close one new consulting client in the next 30 days',
      weekly_routine: 'Prospect for 20 minutes daily',
      start_date: '2026-05-02',
      target_date: '2026-12-31',
      preferred_time: '09:00',
    });

    expect(plan.goals).toHaveLength(3);
    expect(plan.goals[0].timeframe).toBe('yearly');
    expect(plan.goals[1].parent_client_id).toBe('yearly');
    expect(plan.goals[2].parent_client_id).toBe('monthly');
    expect(plan.action_plan.plan_type).toBe('goal_plan');
  });

  it('materializes only the execution window, not the full year', () => {
    const plan = buildGoalOperatingPlan({
      annual_smart_goal: 'Lose 8kg of fat by December 2026',
      monthly_milestone: 'Lose the first 1kg this month',
      weekly_routine: 'Walk 30 minutes daily',
      start_date: '2026-01-01',
      target_date: '2026-12-31',
      preferred_time: '07:30',
      execution_window_days: 14,
    });

    // 14-day window starting 2026-01-01 = 14 daily tasks
    expect(plan.active_tasks).toHaveLength(14);
    expect(plan.future_work_template.concrete_window_days).toBe(14);
    expect(plan.active_tasks[0].scheduled_date).toBe('2026-01-01');
    expect(plan.active_tasks[plan.active_tasks.length - 1].scheduled_date).toBe('2026-01-14');
    // Goal target_date is still the full year
    expect(plan.goals[0].due_on).toBe('2026-12-31');
  });

  it('respects weekend cadence without creating weekday work', () => {
    const plan = buildGoalOperatingPlan({
      annual_smart_goal: 'Build a weekend consulting pipeline by June',
      monthly_milestone: 'Complete four weekend work sessions this month',
      weekly_routine: 'trabalhar 60 minutos nos finais de semana',
      start_date: '2026-05-01',
      preferred_time: '09:00',
      execution_window_days: 14,
    });

    // May 1 (Fri) + 14 days window: weekends = May 2, 3, 9, 10
    expect(plan.active_tasks.map(task => task.scheduled_date)).toEqual([
      '2026-05-02',
      '2026-05-03',
      '2026-05-09',
      '2026-05-10',
    ]);
    expect(plan.future_work_template.cadence_summary).toBe('weekends only');
  });

  it('respects weekday cadence', () => {
    const plan = buildGoalOperatingPlan({
      annual_smart_goal: 'Improve focus by building a workday ritual',
      monthly_milestone: 'Complete the first workweek ritual streak',
      weekly_routine: 'Deep work for 30 minutes on weekdays',
      start_date: '2026-05-04',
      execution_window_days: 7,
    });

    // Mon May 4 + 7 days: Mon–Fri = May 4, 5, 6, 7, 8
    expect(plan.active_tasks.map(task => task.scheduled_date)).toEqual([
      '2026-05-04',
      '2026-05-05',
      '2026-05-06',
      '2026-05-07',
      '2026-05-08',
    ]);
  });

  it('respects named weekday cadence', () => {
    const plan = buildGoalOperatingPlan({
      annual_smart_goal: 'Build a consistent study habit by June',
      monthly_milestone: 'Complete four study sessions this month',
      weekly_routine: 'Study 45 minutes Monday and Wednesday',
      start_date: '2026-05-01',
      execution_window_days: 14,
    });

    // May 1 (Fri) + 14 days: Mondays = May 4, 11; Wednesdays = May 6, 13
    expect(plan.active_tasks.map(task => task.scheduled_date)).toEqual([
      '2026-05-04',
      '2026-05-06',
      '2026-05-11',
      '2026-05-13',
    ]);
  });

  it('uses explicit duration from routine text', () => {
    const plan = buildGoalOperatingPlan({
      annual_smart_goal: 'Write a complete book draft by December',
      monthly_milestone: 'Draft chapter one this month',
      weekly_routine: 'Write for 45 minutes daily',
      start_date: '2026-05-02',
    });

    expect(plan.active_tasks[0].duration_minutes).toBe(45);
    expect(plan.active_tasks[0].needs_time_confirmation).toBe(true);
  });

  it('warns when duration or preferred time are inferred', () => {
    const plan = buildGoalOperatingPlan({
      annual_smart_goal: 'Improve Portuguese fluency by December',
      monthly_milestone: 'Finish the first study unit this month',
      weekly_routine: 'Practice pronunciation daily',
      start_date: '2026-05-02',
    });

    expect(plan.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('durations were inferred'),
      expect.stringContaining('No preferred time'),
    ]));
  });

  it('rejects incomplete proposal data', () => {
    expect(() => buildGoalOperatingPlan({
      annual_smart_goal: '',
      monthly_milestone: 'First milestone',
      weekly_routine: 'Practice',
    })).toThrow('annual_smart_goal is required');
  });

  it('books a single per-day block when the routine has a clear time range', () => {
    const plan = buildGoalOperatingPlan({
      annual_smart_goal: 'Finalizar o app Flowme até dezembro',
      monthly_milestone: 'Concluir a v1 mobile no fim do mes',
      weekly_routine: 'Trabalhar no app das 14h as 17h finais de semana',
      start_date: '2026-05-23',
    });

    const sat = plan.active_tasks.find((t) => t.scheduled_date === '2026-05-23');
    expect(sat).toBeDefined();
    expect(sat?.duration_minutes).toBe(180);
    expect(sat?.start_at).toMatch(/T14:00:00/);
    expect(sat?.end_at).toMatch(/T17:00:00/);

    const sameDayTasks = plan.active_tasks.filter((t) => t.scheduled_date === '2026-05-23');
    expect(sameDayTasks).toHaveLength(1);
  });

  it('leaves start_at and end_at null when the user did not pick a time', () => {
    const plan = buildGoalOperatingPlan({
      annual_smart_goal: 'Aprender ingles ate dezembro de 2026',
      monthly_milestone: 'Concluir unidade 1 ate o fim do mes',
      weekly_routine: 'Estudar uma hora todo dia',
      start_date: '2026-05-23',
    });

    expect(plan.active_tasks.length).toBeGreaterThan(0);
    for (const task of plan.active_tasks) {
      expect(task.start_at).toBeNull();
      expect(task.end_at).toBeNull();
    }
  });

  it('dedupes identical routine task titles instead of stacking them', () => {
    const plan = buildGoalOperatingPlan({
      annual_smart_goal: 'Estudar ingles para fluencia em dezembro',
      monthly_milestone: 'Concluir unidade 1 ate o fim do mes',
      weekly_routine: 'Estudar ingles; Estudar ingles; Estudar ingles',
      preferred_time: '08:00',
      start_date: '2026-05-23',
    });

    const dayTasks = plan.active_tasks.filter((t) => t.scheduled_date === '2026-05-23');
    expect(dayTasks).toHaveLength(1);
  });
});
