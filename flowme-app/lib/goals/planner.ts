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
  priority_label: 'event';
}

export interface PlannedTaskOccurrence {
  client_id: string;
  title: string;
  description: string;
  scheduled_date: string;
  start_at: string | null;
  end_at: string | null;
  duration_minutes: number;
  category: 'event';
  priority: number;
  priority_source: 'balys';
  priority_reason: string;
  source_type: 'goal_task';
  plan_day: number;
  sort_order: number;
  needs_time_confirmation: boolean;
}

export interface PlannedRecurringEvent {
  client_id: string;
  title: string;
  description: string;
  scheduled_date: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  days_of_week: number[];
  recurrence: string[];
}

export interface GoalOperatingPlan {
  goals: PlannedGoalRecord[];
  action_plan: PlannedActionPlanRecord;
  active_tasks: PlannedTaskOccurrence[];
  recurring_events: PlannedRecurringEvent[];
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
  const interval = extractTimeRange(input.weekly_routine);
  const explicitPreferred = input.preferred_time && /^\d{2}:\d{2}$/.test(input.preferred_time)
    ? input.preferred_time
    : null;
  const preferredTime = explicitPreferred || interval?.startTime || null;
  const durationFromInterval = interval?.durationMin;
  const duration = normalizeDuration(durationFromInterval ?? input.default_task_duration_minutes);
  const annualTitle = cleanTitle(input.annual_smart_goal);
  const monthlyTitle = cleanTitle(input.monthly_milestone);
  const weeklyTitle = cleanTitle(input.weekly_routine);
  const routineTasks = extractRoutineTasks(input.weekly_routine, duration, Boolean(interval));
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
    priority_label: 'event',
  };

  const activeTasks = createExecutionWindowTasks({
    startDate,
    windowEnd,
    preferredTime,
    routineTasks,
    cadence,
  });
  const recurringEvents = createRecurringEvents({
    startDate,
    targetDate,
    preferredTime,
    duration,
    weeklyRoutine: input.weekly_routine,
    contextTitle: monthlyTitle || annualTitle,
    routineTasks,
    cadence,
  });

  return {
    goals,
    action_plan: actionPlan,
    active_tasks: activeTasks,
    recurring_events: recurringEvents,
    future_work_template: {
      weekly_routine: input.weekly_routine.trim(),
      recurrence_summary: `${recurringEvents.length} recurring calendar series scheduled from ${startDate} to ${targetDate}.`,
      concrete_window_days: executionWindowDays,
      cadence_summary: cadence.summary,
    },
    warnings,
  };
}

function createRecurringEvents({
  startDate,
  targetDate,
  preferredTime,
  duration,
  weeklyRoutine,
  contextTitle,
  routineTasks,
  cadence,
}: {
  startDate: string;
  targetDate: string;
  preferredTime: string | null;
  duration: number;
  weeklyRoutine: string;
  contextTitle: string;
  routineTasks: Array<{ title: string; durationMinutes: number; inferredDuration: boolean }>;
  cadence: Cadence;
}): PlannedRecurringEvent[] {
  const explicitSchedules = extractScheduleRules(weeklyRoutine, preferredTime, duration);
  const schedules = explicitSchedules.length > 0
    ? explicitSchedules
    : [{
      daysOfWeek: cadence.daysOfWeek,
      startTime: preferredTime || '09:00',
      durationMinutes: routineTasks.reduce((sum, task) => sum + task.durationMinutes, 0) || duration,
      title: routineTasks.length === 1 ? routineTasks[0].title : composeDayTitle(routineTasks),
    }];

  return schedules.map((schedule, index) => {
    const scheduledDate = firstMatchingDate(startDate, schedule.daysOfWeek);
    const { startAt, endAt } = buildTaskTimes(scheduledDate, schedule.startTime, schedule.durationMinutes, 0, 0);
    const title = contextualEventTitle(schedule.title || (routineTasks.length === 1 ? routineTasks[0].title : composeDayTitle(routineTasks)), contextTitle);
    const description = composeDayDescription(routineTasks);
    return {
      client_id: `recurrence-${index + 1}`,
      title,
      description,
      scheduled_date: scheduledDate,
      start_at: startAt || `${scheduledDate}T09:00:00.000Z`,
      end_at: endAt || addMinutesIso(`${scheduledDate}T09:00:00.000Z`, schedule.durationMinutes),
      duration_minutes: schedule.durationMinutes,
      days_of_week: schedule.daysOfWeek,
      recurrence: [weeklyRRule(schedule.daysOfWeek, targetDate)],
    };
  });
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
    if (routineTasks.length === 0) continue;

    const totalDuration = routineTasks.reduce((sum, task) => sum + task.durationMinutes, 0);
    const { startAt, endAt } = buildTaskTimes(scheduledDate, preferredTime, totalDuration, 0, 0);
    const title = routineTasks.length === 1 ? routineTasks[0].title : composeDayTitle(routineTasks);
    const description = composeDayDescription(routineTasks);

    tasks.push({
      client_id: `task-${planDay}`,
      title,
      description,
      scheduled_date: scheduledDate,
      start_at: startAt,
      end_at: endAt,
      duration_minutes: totalDuration,
      category: 'event',
      priority: 0,
      priority_source: 'balys',
      priority_reason: planDay === 1
        ? 'First-day kickoff task for the accepted goal plan.'
        : 'Execution-window task for the accepted goal plan.',
      source_type: 'goal_task',
      plan_day: planDay,
      sort_order: dayOffset * 10,
      needs_time_confirmation: !preferredTime,
    });
  }
  return tasks;
}

function composeDayTitle(routineTasks: Array<{ title: string }>): string {
  const first = routineTasks[0]?.title || 'Execução do plano';
  return summarizeTitle(first);
}

function contextualEventTitle(candidate: string, contextTitle: string): string {
  const summarized = summarizeTitle(candidate);
  if (!isContextlessTitle(summarized)) return summarized;
  const fallback = summarizeTitle(contextTitle);
  return fallback ? `Avançar: ${fallback}` : summarized;
}

function composeDayDescription(routineTasks: Array<{ title: string; durationMinutes: number }>): string {
  if (routineTasks.length === 1) {
    const onlyTask = routineTasks[0];
    return `Atividade do dia: ${onlyTask.title}.`;
  }
  const numbered = routineTasks
    .map((task, idx) => `${idx + 1} — ${task.title} (${task.durationMinutes} min)`)
    .join('\n');
  return `Atividades do dia:\n${numbered}`;
}

interface Cadence {
  daysOfWeek: number[];
  summary: string;
  inferred: boolean;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function resolveCadence(text: string): Cadence {
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\b(weekends?|finais? de semana|fim de semana|final de semana)\b/.test(normalized)) {
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

function extractRoutineTasks(weeklyRoutine: string, defaultDuration: number, collapseToSingle: boolean): Array<{ title: string; durationMinutes: number; inferredDuration: boolean }> {
  if (collapseToSingle) {
    return [{
      title: cleanTaskTitle(weeklyRoutine, 0),
      durationMinutes: defaultDuration,
      inferredDuration: false,
    }];
  }
  const parts = weeklyRoutine
    .split(/\n|;/)
    .map(part => part.trim())
    .filter(Boolean);
  const candidates = parts.length > 0 ? parts : [weeklyRoutine.trim()];
  const seen = new Set<string>();
  const tasks: Array<{ title: string; durationMinutes: number; inferredDuration: boolean }> = [];
  candidates.slice(0, 4).forEach((candidate, index) => {
    const cleanedTitle = cleanTaskTitle(candidate, index);
    const dedupeKey = cleanedTitle.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    const explicit = extractDuration(candidate);
    tasks.push({
      title: cleanedTitle,
      durationMinutes: explicit ?? defaultDuration,
      inferredDuration: explicit === null,
    });
  });
  return tasks;
}

// Detects "14h às 17h", "14:00-17:00", "2pm to 5pm" — returns the start time
// and the total block duration so we book one calendar event per day, not
// N stacked 15-min blocks. Also catches a single start time paired with a
// duration ("às 9h durante 1 hora").
export function extractTimeRange(text: string): { startTime: string; endTime: string; durationMin: number } | null {
  const normalized = text.toLowerCase();
  const rangePatterns: RegExp[] = [
    /\b(\d{1,2})(?::(\d{2}))?\s*h(?:oras?)?\s*(?:[àa]s?|at[ée]|to|-|–|—)\s*(\d{1,2})(?::(\d{2}))?\s*h(?:oras?)?\b/,
    /\b(\d{1,2}):(\d{2})\s*(?:[àa]s?|at[ée]|to|-|–|—)\s*(\d{1,2}):(\d{2})\b/,
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:to|-|–|—|at[ée])\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/,
  ];
  for (const pattern of rangePatterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const isAmPmPattern = pattern.source.includes('am|pm');
    let startHour: number;
    let startMin: number;
    let endHour: number;
    let endMin: number;
    if (isAmPmPattern) {
      startHour = parseInt(match[1], 10);
      startMin = match[2] ? parseInt(match[2], 10) : 0;
      const startMer = match[3];
      endHour = parseInt(match[4], 10);
      endMin = match[5] ? parseInt(match[5], 10) : 0;
      const endMer = match[6];
      if (startMer === 'pm' && startHour < 12) startHour += 12;
      if (startMer === 'am' && startHour === 12) startHour = 0;
      if (endMer === 'pm' && endHour < 12) endHour += 12;
      if (endMer === 'am' && endHour === 12) endHour = 0;
    } else {
      startHour = parseInt(match[1], 10);
      startMin = match[2] ? parseInt(match[2], 10) : 0;
      endHour = parseInt(match[3], 10);
      endMin = match[4] ? parseInt(match[4], 10) : 0;
    }
    if (startHour > 23 || endHour > 23 || startMin > 59 || endMin > 59) continue;
    const startTotal = startHour * 60 + startMin;
    const endTotal = endHour * 60 + endMin;
    const durationMin = endTotal - startTotal;
    if (durationMin <= 0 || durationMin > 24 * 60) continue;
    return {
      startTime: `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
      endTime: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`,
      durationMin,
    };
  }

  // Fallback: a single start time paired with an explicit duration that
  // appears as "durante/por/for X (minutes|hours)" or "X (minutes|hours) por dia".
  const startMatch = normalized.match(/\b(?:[àa]s?\s+|at\s+)?(\d{1,2})(?::(\d{2}))?\s*(h|hs|h(?:oras?)?|am|pm)?\b/);
  const durationMatch = normalized.match(/\b(?:durante|por|for|de)\s+(\d{1,3})\s*(min|mins|minute|minutes|minuto|minutos|h|hr|hrs|hour|hours|hora|horas)\b/);
  const durationMin = durationMatch
    ? (durationMatch[2].toLowerCase().startsWith('h') ? Number(durationMatch[1]) * 60 : Number(durationMatch[1]))
    : null;
  if (startMatch && durationMin !== null && durationMin > 0) {
    let startHour = parseInt(startMatch[1], 10);
    const startMin = startMatch[2] ? parseInt(startMatch[2], 10) : 0;
    const suffix = startMatch[3] || '';
    if (suffix === 'pm' && startHour < 12) startHour += 12;
    if (suffix === 'am' && startHour === 12) startHour = 0;
    if (startHour > 23 || startMin > 59) return null;
    const startTotal = startHour * 60 + startMin;
    const endTotal = startTotal + durationMin;
    const endHour = Math.floor(endTotal / 60) % 24;
    const endMin = endTotal % 60;
    return {
      startTime: `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
      endTime: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`,
      durationMin,
    };
  }
  return null;
}

function extractDuration(text: string): number | null {
  const match = text.match(/(\d{1,3})\s*(min|mins|minute|minutes|minuto|minutos|h|hr|hrs|hour|hours|hora|horas)\b/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = match[2].toLowerCase();
  return unit.startsWith('h') || unit.startsWith('hora') ? amount * 60 : amount;
}

type ScheduleRule = {
  daysOfWeek: number[];
  startTime: string;
  durationMinutes: number;
  title: string;
};

const DAY_CODES: Record<number, string> = {
  0: 'SU',
  1: 'MO',
  2: 'TU',
  3: 'WE',
  4: 'TH',
  5: 'FR',
  6: 'SA',
};

function extractScheduleRules(text: string, fallbackStartTime: string | null, fallbackDuration: number): ScheduleRule[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const dayGroup = [
    'segunda\\s+a\\s+domingo',
    'segunda\\s+a\\s+sexta',
    'sabado\\s+e\\s+domingo',
    'sábado\\s+e\\s+domingo',
    'finais?\\s+de\\s+semana',
    'fim\\s+de\\s+semana',
    'final\\s+de\\s+semana',
    'dias\\s+uteis',
    'dias\\s+úteis',
    'todos\\s+os\\s+dias',
    'todo\\s+dia',
    'diariamente',
    'weekdays?',
    'weekends?',
    'daily',
    'every\\s+day',
    'monday\\s+to\\s+friday',
    'monday\\s+through\\s+sunday',
    'segunda',
    'terça',
    'terca',
    'quarta',
    'quinta',
    'sexta',
    'sabado',
    'sábado',
    'domingo',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ].join('|');
  const time = '(\\d{1,2}(?::\\d{2})?\\s*(?:h|hs|horas?)?(?:\\s*(?:[àa]s?|ate|até|to|-)\\s*\\d{1,2}(?::\\d{2})?\\s*(?:h|hs|horas?)?)?)';
  const regex = new RegExp(`\\b(${dayGroup})\\b[^\\d]{0,32}(?:às?|as|at)?\\s*${time}`, 'gi');
  const matches = Array.from(normalized.matchAll(regex));
  const rules = matches
    .map((match) => {
      const daysOfWeek = daysForText(match[1]);
      const interval = extractTimeRange(match[2]);
      const startTime = interval?.startTime || normalizeStartTime(match[2]) || fallbackStartTime;
      if (!startTime || daysOfWeek.length === 0) return null;
      return {
        daysOfWeek,
        startTime,
        durationMinutes: interval?.durationMin || extractDuration(normalized) || fallbackDuration,
        title: summarizeTitle(normalized),
      };
    })
    .filter((rule): rule is ScheduleRule => Boolean(rule));

  return dedupeScheduleRules(rules);
}

function daysForText(value: string): number[] {
  const normalized = value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/segunda\s+a\s+domingo|todos os dias|todo dia|diariamente|daily|every day|monday through sunday/.test(normalized)) return ALL_DAYS;
  if (/segunda\s+a\s+sexta|dias uteis|weekday|monday to friday/.test(normalized)) return [1, 2, 3, 4, 5];
  if (/sabado\s+e\s+domingo|fim de semana|final de semana|finais de semana|weekend/.test(normalized)) return [0, 6];
  const named = [
    { day: 0, pattern: /\b(sunday|domingo)\b/ },
    { day: 1, pattern: /\b(monday|segunda)\b/ },
    { day: 2, pattern: /\b(tuesday|terca)\b/ },
    { day: 3, pattern: /\b(wednesday|quarta)\b/ },
    { day: 4, pattern: /\b(thursday|quinta)\b/ },
    { day: 5, pattern: /\b(friday|sexta)\b/ },
    { day: 6, pattern: /\b(saturday|sabado)\b/ },
  ];
  return named.filter(({ pattern }) => pattern.test(normalized)).map(({ day }) => day);
}

function normalizeStartTime(value: string): string | null {
  const match = value.toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(h|hs|horas?)?/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function dedupeScheduleRules(rules: ScheduleRule[]): ScheduleRule[] {
  const seen = new Set<string>();
  return rules.filter((rule) => {
    const key = `${rule.daysOfWeek.join(',')}|${rule.startTime}|${rule.durationMinutes}|${rule.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildTaskTimes(date: string, preferredTime: string | null, durationMinutes: number, index: number, priorDurationsMin: number): { startAt: string | null; endAt: string | null } {
  if (!preferredTime || !/^\d{2}:\d{2}$/.test(preferredTime)) return { startAt: null, endAt: null };
  const [hour, minute] = preferredTime.split(':').map(Number);
  const start = new Date(`${date}T00:00:00.000Z`);
  start.setUTCHours(hour, minute + (index > 0 ? priorDurationsMin : 0), 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function firstMatchingDate(startDate: string, daysOfWeek: number[]): string {
  for (let offset = 0; offset < 7; offset++) {
    const date = addDays(startDate, offset);
    const dow = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    if (daysOfWeek.includes(dow)) return date;
  }
  return startDate;
}

function weeklyRRule(daysOfWeek: number[], targetDate: string): string {
  const byDay = [...daysOfWeek].sort().map(day => DAY_CODES[day]).join(',');
  return `RRULE:FREQ=WEEKLY;BYDAY=${byDay};UNTIL=${targetDate.replace(/-/g, '')}T235959Z`;
}

function addMinutesIso(startIso: string, minutes: number): string {
  return new Date(new Date(startIso).getTime() + minutes * 60000).toISOString();
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
  return summarizeTitle(cleaned) || `Goal task ${index + 1}`;
}

// Convert verbose routine prose into a short, keyword-style event title that
// stays under MAX_TITLE_LEN. Picks the meaningful action phrase ("para estudar
// Clean Architecture" → "Estudar Clean Architecture") when possible and falls
// back to truncation with an ellipsis.
const MAX_TITLE_LEN = 50;

export function summarizeTitle(input: string): string {
  if (!input) return '';
  let text = input
    .replace(/\s+/g, ' ')
    .replace(/\b(\d{1,2}):(\d{2})\b/g, '')
    .replace(/\b(?:às?|as|at)\s*\d{1,2}(?:h\d{0,2})?\b/gi, '')
    .replace(/\b(?:durante|por|for|de)\s+\d{1,3}\s*(min|mins|minute|minutes|minuto|minutos|h|hr|hrs|hour|hours|hora|horas)\b/gi, '')
    .replace(/\b(todos os dias|todo dia|diariamente|daily|every day|segunda a domingo|segunda a sexta|dias uteis|dias úteis|weekdays?|weekends?)\b/gi, '')
    .replace(/[ ,;.]+,/g, ',')
    .replace(/^[ ,;.\-–—]+|[ ,;.\-–—]+$/g, '')
    .trim();

  const paraMatch = text.match(/\bpara\s+([a-záàâãéêíóôõúüç]+(?:ar|er|ir)\b[^,.;\n]*)/i);
  if (paraMatch && paraMatch[1].trim().length >= 6) {
    text = paraMatch[1].trim();
  } else {
    const paraObjectMatch = /^(dedicar|dedicar-se|focar|trabalhar|avancar|avançar)\b/i.test(text)
      ? text.match(/\bpara\s+(?:o|a|os|as|um|uma)?\s*([^,.;\n]{6,})/i)
      : null;
    if (paraObjectMatch && paraObjectMatch[1].trim().length >= 6) {
      text = paraObjectMatch[1].trim();
    } else {
      const forMatch = text.match(/\bfor\s+([a-zA-Z]+ing\b[^,.;\n]*)/i);
      if (forMatch && forMatch[1].trim().length >= 6) text = forMatch[1].trim();
    }
  }

  text = text.split(/[,;.\n]/)[0].trim();
  text = text.replace(/(^|\s)(?:às?|as|at)(?=\s|$)/gi, ' ').replace(/\s+/g, ' ').trim();
  text = text.replace(/\b(para|por|em|no|na|nos|nas|for|to)\b\s*$/i, '').trim();
  text = text.replace(/^[ ,;.\-–—]+|[ ,;.\-–—]+$/g, '').trim();
  if (text.length > 0) text = text.charAt(0).toUpperCase() + text.slice(1);

  if (text.length <= MAX_TITLE_LEN) return text;
  const truncated = text.slice(0, MAX_TITLE_LEN - 1);
  const lastSpace = truncated.lastIndexOf(' ');
  const cut = lastSpace > MAX_TITLE_LEN - 15 ? truncated.slice(0, lastSpace) : truncated;
  return `${cut.replace(/[ ,;.\-–—]+$/g, '')}…`;
}

function isContextlessTitle(title: string): boolean {
  const normalized = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (!normalized) return true;
  if (/^goal task \d+$/.test(normalized)) return true;
  if (/^(dedicar|dedicar-se|focar|trabalhar|avancar)(\s+(para|em|no|na|nos|nas))?$/.test(normalized)) return true;
  if (/\b(para|em|no|na|nos|nas|for|to)$/.test(normalized)) return true;
  return false;
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
