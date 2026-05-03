export interface GoalProposalInput {
  annual_smart_goal: string;
  monthly_milestone: string;
  weekly_routine: string;
  start_date?: string;
  target_date?: string;
  preferred_time?: string;
  default_task_duration_minutes?: number;
  execution_window_days?: number;
}

export interface PlannedGoalRecord {
  client_id: string;
  title: string;
  description: string;
  timeframe: 'yearly' | 'monthly' | 'weekly';
  parent_client_id: string | null;
  status: 'not_started' | 'in_progress';
  starts_on: string;
  due_on: string;
  target_date: string;
  success_criteria: string;
}

export interface PlannedActionPlanRecord {
  client_id: string;
  title: string;
  description: string;
  plan_type: 'goal_plan';
  duration_days: number;
  starts_on: string;
  review_date: string;
  success_criteria: string;
  priority_label: 'non_negotiable' | 'negotiable' | 'routine';
}

export interface PlannedTaskOccurrence {
  client_id: string;
  title: string;
  description: string;
  scheduled_date: string;
  start_at: string | null;
  end_at: string | null;
  duration_minutes: number;
  category: 'non_negotiable' | 'negotiable' | 'routine';
  priority: number;
  priority_source: 'balys';
  priority_reason: string;
  source_type: 'goal_task';
  plan_day: number;
  sort_order: number;
  needs_time_confirmation: boolean;
}

export interface GoalOperatingPlan {
  goals: PlannedGoalRecord[];
  action_plan: PlannedActionPlanRecord;
  active_tasks: PlannedTaskOccurrence[];
  future_work_template: {
    weekly_routine: string;
    recurrence_summary: string;
    concrete_window_days: number;
    cadence_summary: string;
  };
  warnings: string[];
}

const DEFAULT_DURATION_MINUTES = 15;
// Max days of concrete tasks to materialize up-front. The action plan is a
// rolling sprint — tasks beyond this window are created when the plan renews.
const MAX_EXECUTION_WINDOW_DAYS = 21;
const DEFAULT_EXECUTION_WINDOW_DAYS = 14;

export function buildGoalOperatingPlan(input: GoalProposalInput): GoalOperatingPlan {
  validateProposal(input);

  const startDate = input.start_date || todayIsoDate();
  const targetDate = input.target_date || endOfYear(startDate);
  const monthlyDue = addDays(startDate, 30);
  const weeklyDue = addDays(startDate, 7);
  const duration = normalizeDuration(input.default_task_duration_minutes);
  const annualTitle = cleanTitle(input.annual_smart_goal);
  const monthlyTitle = cleanTitle(input.monthly_milestone);
  const weeklyTitle = cleanTitle(input.weekly_routine);
  const routineTasks = extractRoutineTasks(input.weekly_routine, duration);
  const cadence = resolveCadence(input.weekly_routine);
  const warnings: string[] = [];

  // Action plan is a short sprint (max 21 days). Tasks are only materialized
  // for this window; the plan renews when its review_date arrives.
  const rawWindow = input.execution_window_days ?? DEFAULT_EXECUTION_WINDOW_DAYS;
  const executionWindowDays = clampInteger(rawWindow, 1, MAX_EXECUTION_WINDOW_DAYS);
  const windowEnd = addDays(startDate, executionWindowDays - 1);

  if (routineTasks.some(task => task.inferredDuration)) {
    warnings.push('Some task durations were inferred. Confirm duration before scheduling long-term blocks.');
  }
  if (cadence.inferred) {
    warnings.push('Cadence was inferred as daily. Confirm which days this work belongs on.');
  }
  if (!input.preferred_time) {
    warnings.push('No preferred time provided. Events are flexible until the user chooses a time.');
  }

  const goals: PlannedGoalRecord[] = [
    {
      client_id: 'yearly',
      title: annualTitle,
      description: input.annual_smart_goal.trim(),
      timeframe: 'yearly',
      parent_client_id: null,
      status: 'in_progress',
      starts_on: startDate,
      due_on: targetDate,
      target_date: `${targetDate}T23:59:59.000Z`,
      success_criteria: input.annual_smart_goal.trim(),
    },
    {
      client_id: 'monthly',
      title: monthlyTitle,
      description: input.monthly_milestone.trim(),
      timeframe: 'monthly',
      parent_client_id: 'yearly',
      status: 'not_started',
      starts_on: startDate,
      due_on: monthlyDue,
      target_date: `${monthlyDue}T23:59:59.000Z`,
      success_criteria: input.monthly_milestone.trim(),
    },
    {
      client_id: 'weekly',
      title: weeklyTitle,
      description: input.weekly_routine.trim(),
      timeframe: 'weekly',
      parent_client_id: 'monthly',
      status: 'not_started',
      starts_on: startDate,
      due_on: weeklyDue,
      target_date: `${weeklyDue}T23:59:59.000Z`,
      success_criteria: input.weekly_routine.trim(),
    },
  ];

  // The action plan is a short execution sprint, not the goal itself.
  // It covers executionWindowDays and should be renewed at review_date.
  const actionPlan: PlannedActionPlanRecord = {
    client_id: 'goal-plan',
    title: `Action plan: ${annualTitle}`,
    description: `First ${executionWindowDays}-day execution sprint for: ${input.annual_smart_goal.trim()}`,
    plan_type: 'goal_plan',
    duration_days: executionWindowDays,
    starts_on: startDate,
    review_date: windowEnd,
    success_criteria: input.monthly_milestone.trim(),
    priority_label: 'non_negotiable',
  };

  const activeTasks = createExecutionWindowTasks({
    startDate,
    windowEnd,
    preferredTime: input.preferred_time || null,
    routineTasks,
    cadence,
  });

  return {
    goals,
    action_plan: actionPlan,
    active_tasks: activeTasks,
    future_work_template: {
      weekly_routine: input.weekly_routine.trim(),
      recurrence_summary: `Tasks materialized for the first ${executionWindowDays} days (${startDate} to ${windowEnd}). Renew the action plan at review_date to continue.`,
      concrete_window_days: executionWindowDays,
      cadence_summary: cadence.summary,
    },
    warnings,
  };
}

function createExecutionWindowTasks({
  startDate,
  windowEnd,
  preferredTime,
  routineTasks,
  cadence,
}: {
  startDate: string;
  windowEnd: string;
  preferredTime: string | null;
  routineTasks: Array<{ title: string; durationMinutes: number; inferredDuration: boolean }>;
  cadence: Cadence;
}): PlannedTaskOccurrence[] {
  const tasks: PlannedTaskOccurrence[] = [];
  const planDays = daysBetweenInclusive(startDate, windowEnd);
  let planDay = 0;
  for (let dayOffset = 0; dayOffset < planDays; dayOffset++) {
    const scheduledDate = addDays(startDate, dayOffset);
    const dayOfWeek = new Date(`${scheduledDate}T00:00:00.000Z`).getUTCDay();
    if (!cadence.daysOfWeek.includes(dayOfWeek)) continue;
    planDay += 1;
    routineTasks.forEach((task, taskIndex) => {
      const { startAt, endAt } = buildTaskTimes(scheduledDate, preferredTime, task.durationMinutes, taskIndex);
      tasks.push({
        client_id: `task-${planDay}-${taskIndex + 1}`,
        title: task.title,
        description: `Execution task from the weekly routine: ${task.title}`,
        scheduled_date: scheduledDate,
        start_at: startAt,
        end_at: endAt,
        duration_minutes: task.durationMinutes,
        category: planDay === 1 ? 'non_negotiable' : 'negotiable',
        priority: planDay === 1 ? 3 : 2,
        priority_source: 'balys',
        priority_reason: planDay === 1
          ? 'First-day kickoff task for the accepted goal plan.'
          : 'Full-period execution event for the accepted goal plan.',
        source_type: 'goal_task',
        plan_day: planDay,
        sort_order: dayOffset * 10 + taskIndex,
        needs_time_confirmation: !preferredTime,
      });
    });
  }
  return tasks;
}

interface Cadence {
  daysOfWeek: number[];
  summary: string;
  inferred: boolean;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function resolveCadence(text: string): Cadence {
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\b(weekends?|finais? de semana|fim de semana)\b/.test(normalized)) {
    return { daysOfWeek: [0, 6], summary: 'weekends only', inferred: false };
  }
  if (/\b(weekdays?|dias uteis|segunda a sexta|monday to friday)\b/.test(normalized)) {
    return { daysOfWeek: [1, 2, 3, 4, 5], summary: 'weekdays only', inferred: false };
  }
  if (/\b(daily|every day|todo dia|todos os dias|diariamente)\b/.test(normalized)) {
    return { daysOfWeek: ALL_DAYS, summary: 'daily', inferred: false };
  }

  const namedDays = [
    { day: 0, pattern: /\b(sunday|domingo)\b/ },
    { day: 1, pattern: /\b(monday|segunda)\b/ },
    { day: 2, pattern: /\b(tuesday|terca)\b/ },
    { day: 3, pattern: /\b(wednesday|quarta)\b/ },
    { day: 4, pattern: /\b(thursday|quinta)\b/ },
    { day: 5, pattern: /\b(friday|sexta)\b/ },
    { day: 6, pattern: /\b(saturday|sabado)\b/ },
  ];
  const daysOfWeek = namedDays.filter(({ pattern }) => pattern.test(normalized)).map(({ day }) => day);
  if (daysOfWeek.length > 0) {
    return { daysOfWeek: Array.from(new Set(daysOfWeek)).sort(), summary: 'specific weekdays', inferred: false };
  }

  const frequency = normalized.match(/\b([1-6])\s*(x|times|vezes)\s*(por|per)?\s*(semana|week)\b/);
  if (frequency) {
    const count = clampInteger(Number(frequency[1]), 1, 6);
    const templates: Record<number, number[]> = {
      1: [1],
      2: [1, 4],
      3: [1, 3, 5],
      4: [1, 2, 4, 5],
      5: [1, 2, 3, 4, 5],
      6: [1, 2, 3, 4, 5, 6],
    };
    return { daysOfWeek: templates[count], summary: `${count} times per week`, inferred: false };
  }

  return { daysOfWeek: ALL_DAYS, summary: 'daily inferred', inferred: true };
}

function extractRoutineTasks(weeklyRoutine: string, defaultDuration: number): Array<{ title: string; durationMinutes: number; inferredDuration: boolean }> {
  const parts = weeklyRoutine
    .split(/\n|;|\.|,(?=\s*[A-ZÀ-Ú])/)
    .map(part => part.trim())
    .filter(Boolean);
  const candidates = parts.length > 0 ? parts : [weeklyRoutine.trim()];
  return candidates.slice(0, 4).map((candidate, index) => {
    const explicit = extractDuration(candidate);
    return {
      title: cleanTaskTitle(candidate, index),
      durationMinutes: explicit ?? defaultDuration,
      inferredDuration: explicit === null,
    };
  });
}

function extractDuration(text: string): number | null {
  const match = text.match(/(\d{1,3})\s*(min|mins|minute|minutes|minuto|minutos|h|hr|hrs|hour|hours|hora|horas)\b/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = match[2].toLowerCase();
  return unit.startsWith('h') || unit.startsWith('hora') ? amount * 60 : amount;
}

function buildTaskTimes(date: string, preferredTime: string | null, durationMinutes: number, index: number): { startAt: string | null; endAt: string | null } {
  if (!preferredTime || !/^\d{2}:\d{2}$/.test(preferredTime)) return { startAt: null, endAt: null };
  const [hour, minute] = preferredTime.split(':').map(Number);
  const start = new Date(`${date}T00:00:00.000Z`);
  start.setUTCHours(hour, minute + index * 15, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function validateProposal(input: GoalProposalInput) {
  if (!input.annual_smart_goal || input.annual_smart_goal.trim().length < 8) {
    throw new Error('annual_smart_goal is required');
  }
  if (!input.monthly_milestone || input.monthly_milestone.trim().length < 4) {
    throw new Error('monthly_milestone is required');
  }
  if (!input.weekly_routine || input.weekly_routine.trim().length < 4) {
    throw new Error('weekly_routine is required');
  }
}

function cleanTitle(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 110 ? `${normalized.slice(0, 107).trim()}...` : normalized;
}

function cleanTaskTitle(value: string, index: number): string {
  const cleaned = value
    .replace(/\b\d{1,3}\s*(min|mins|minute|minutes|minuto|minutos|h|hr|hrs|hour|hours|hora|horas)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || `Goal task ${index + 1}`;
}

function normalizeDuration(value?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_DURATION_MINUTES;
  return clampInteger(value, 1, 240);
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function endOfYear(date: string): string {
  return `${date.slice(0, 4)}-12-31`;
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number {
  const startMs = new Date(`${start}T00:00:00.000Z`).getTime();
  const endMs = new Date(`${end}T00:00:00.000Z`).getTime();
  return Math.max(1, Math.ceil((endMs - startMs) / 86400000));
}

function daysBetweenInclusive(start: string, end: string): number {
  return daysBetween(start, end) + 1;
}
