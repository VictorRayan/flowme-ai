import {
  buildDayUnit,
  classifyExecutionType,
  inferDurationMinutes,
  normalizeCalendarEventTask,
  normalizeFlowmeEventTask,
} from '@/lib/goals/task-dto';

describe('goal operating task DTO', () => {
  it('infers duration in minutes from start/end', () => {
    expect(inferDurationMinutes('2026-05-02T10:00:00Z', '2026-05-02T10:04:30Z')).toBe(5);
  });

  it('classifies quick work as an event', () => {
    expect(classifyExecutionType(4, false)).toBe('event');
  });

  it('classifies 5 minutes or more as event', () => {
    expect(classifyExecutionType(5, false)).toBe('event');
  });

  it('normalizes a legacy local row into stable task fields', () => {
    const task = normalizeFlowmeEventTask({
      id: 'task-1',
      title: 'Call Leticia',
      source_type: 'manual',
      category: 'non_negotiable',
      status: 'pending',
      priority: 3,
      scheduled_date: '2026-05-02',
      start_at: '2026-05-02T10:00:00Z',
      end_at: '2026-05-02T10:03:00Z',
      linked_goal_id: 'goal-1',
      action_plan_id: 'plan-1',
      plan_day: 2,
    });

    expect(task.task_id).toBe('manual:task-1');
    expect(task.execution_type).toBe('event');
    expect(task.priority_label).toBe('non_negotiable');
    expect(task.linked_goal_id).toBe('goal-1');
    expect(task.action_plan_id).toBe('plan-1');
  });

  it('normalizes a calendar event as an event-style task', () => {
    const task = normalizeCalendarEventTask({
      id: 'google-1',
      title: 'Deep work',
      start_at: '2026-05-02T10:00:00Z',
      end_at: '2026-05-02T11:00:00Z',
    }, '2026-05-02');

    expect(task.task_id).toBe('calendar_event:google-1');
    expect(task.execution_type).toBe('event');
    expect(task.is_time_blocked).toBe(true);
  });

  it('orders a day unit by active priority path and moves completed tasks later', () => {
    const completed = normalizeFlowmeEventTask({
      id: 'done',
      title: 'Already done',
      category: 'non_negotiable',
      outcome: 'completed',
      scheduled_date: '2026-05-02',
    });
    const next = normalizeFlowmeEventTask({
      id: 'next',
      title: 'Continue this',
      category: 'non_negotiable',
      outcome: 'pending',
      scheduled_date: '2026-05-02',
    });
    const unit = buildDayUnit('2026-05-02', 'America/Sao_Paulo', [completed, next]);

    expect(unit.unit_id).toBe('day:2026-05-02');
    expect(unit.tasks[0].source_id).toBe('next');
    expect(unit.summary.completed).toBe(1);
    expect(unit.summary.pending).toBe(1);
  });
});
