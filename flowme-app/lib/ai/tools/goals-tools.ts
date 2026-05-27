import { z } from 'zod';
import { defineTool, ToolContext } from './Tool';
import {
  GoalCalendarEvent,
  GoalCalendarEventStatus,
  listDeletedGoalCalendarEvents,
  listGoalCalendarEvents,
  recordGoalCalendarEventLinks,
  restoreGoalCalendarEvent,
  updateGoalCalendarEventSchedule,
} from '@/lib/goals/calendar-event-links';
import { cleanupPersistedGoalOperatingPlan, persistGoalOperatingPlan } from '@/lib/goals/persist-plan';
import {
  deleteActionPlanRecords,
  deleteGoalRecords,
  gatherActionPlanDeletionTargets,
  gatherGoalDeletionTargets,
} from '@/lib/goals/delete-plan';
import { firstMatchingDate, resolveCadence, weeklyRRule } from '@/lib/goals/planner';
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from '@/lib/google/google-calendar';
import { isCalendarLinkedAccountName } from '@/lib/google/linked-account-kind';

const goalTimeframeSchema = z.enum(['yearly', 'monthly', 'weekly']);
const goalStatusSchema = z.enum(['not_started', 'in_progress', 'completed', 'cancelled']);
const planStatusSchema = z.enum(['not_started', 'in_progress', 'completed', 'cancelled']);

const GOAL_FIELDS = `
  id, title, description, timeframe, parent_goal_id, status, target_date,
  objective_metric, target_value, current_value, unit, starts_on, due_on, success_criteria,
  created_at, updated_at
`;

const ACTION_PLAN_FIELDS = `
  id, title, description, linked_goal_id, linked_goal_ids, plan_type, problem_statement,
  status, duration_days, starts_on, review_date, success_criteria,
  created_at, updated_at
`;

type GoogleAccount = {
  id: string;
  name: string;
  type?: string | null;
};

type CalendarOccurrence = {
  title: string;
  description?: string | null;
  scheduled_date: string;
  start_at?: string | null;
  end_at?: string | null;
  duration_minutes?: number | null;
  recurrence?: string[] | null;
  action_plan_id?: string | null;
  goal_id?: string | null;
  plan_day?: number | null;
  sort_order?: number | null;
};

type CreatedCalendarEventForOccurrence = {
  title: string;
  provider_event_id: string;
  html_link: string;
  start_at: string;
  end_at: string;
  occurrence: CalendarOccurrence;
};

async function resolveGoogleCalendarAccount(
  context: ToolContext,
  accountNickname?: string,
): Promise<{ ok: true; account: GoogleAccount } | { ok: false; error: string }> {
  const { data, error } = await context.supabase
    .from('linked_accounts')
    .select('id, name, type')
    .eq('user_id', context.user.id)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .eq('provider', 'google')
    .order('created_at', { ascending: true });

  if (error || !Array.isArray(data) || data.length === 0) {
    return { ok: false, error: 'No active Google Calendar account connected. Ask the user to connect Google Calendar before creating plans or tasks.' };
  }

  const accounts = (data as GoogleAccount[]).filter((account) => isCalendarLinkedAccountName(account.name));
  if (accounts.length === 0) {
    return { ok: false, error: 'No Google Calendar account is connected. Connectors like Google Docs or Sheets cannot be used to schedule events. Ask the user to connect Google Calendar.' };
  }

  const wanted = String(accountNickname || '').trim().toLowerCase();
  if (wanted) {
    const match = accounts.find((account) => {
      const name = String(account.name || '').trim().toLowerCase();
      const localPart = name.includes('@') ? name.split('@')[0] : name;
      return name === wanted || localPart === wanted || name.includes(wanted) || wanted.includes(name);
    });
    if (match) return { ok: true, account: match };
    return { ok: false, error: `I could not find a Google Calendar account matching "${accountNickname}". Calendar accounts available: ${accounts.map((account) => account.name).join(', ')}. Tell the user the calendar nickname you tried and ask which to use; do not expose technical IDs.` };
  }

  if (accounts.length > 1) {
    return { ok: false, error: `The user has more than one Google Calendar connected. Ask the user which calendar account to use — accept either the email or the nickname. Calendar accounts available: ${accounts.map((account) => account.name).join(', ')}.` };
  }

  return { ok: true, account: accounts[0] };
}

function normalizePreferredTime(input: unknown): unknown {
  if (typeof input !== 'string') return input;
  const text = input.trim().toLowerCase();
  if (!text) return undefined;
  const hhmm = text.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) return `${hhmm[1].padStart(2, '0')}:${hhmm[2]}`;
  const compact = text.match(/^(\d{1,2})h(\d{2})$/);
  if (compact) return `${compact[1].padStart(2, '0')}:${compact[2]}`;
  const hourOnly = text.match(/^(\d{1,2})h?$/);
  if (hourOnly) return `${hourOnly[1].padStart(2, '0')}:00`;
  const ampm = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (ampm) {
    let hour = parseInt(ampm[1], 10);
    if (ampm[3] === 'pm' && hour < 12) hour += 12;
    if (ampm[3] === 'am' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${ampm[2] || '00'}`;
  }
  return input;
}

function timezoneOffset(date: string, timezone: string): string {
  try {
    const probe = new Date(`${date}T12:00:00.000Z`);
    const label = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
      hour: 'numeric',
    }).formatToParts(probe).find(part => part.type === 'timeZoneName')?.value || '';
    const match = label.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (match) {
      const hours = match[2].padStart(2, '0');
      const minutes = (match[3] || '0').padStart(2, '0');
      return `${match[1]}${hours}:${minutes}`;
    }
  } catch {}
  return '+00:00';
}

function defaultStartIso(date: string, timezone: string): string {
  return `${date}T09:00:00${timezoneOffset(date, timezone)}`;
}

function addMinutesIso(startIso: string, minutes: number): string {
  return new Date(new Date(startIso).getTime() + minutes * 60000).toISOString();
}

function wallClockTimeInTz(iso: string, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(iso));
    const hour = parts.find(p => p.type === 'hour')?.value ?? '09';
    const minute = parts.find(p => p.type === 'minute')?.value ?? '00';
    return `${hour === '24' ? '00' : hour}:${minute}`;
  } catch {
    return '09:00';
  }
}

// Build an unambiguous start/end instant for a wall-clock date + HH:MM time in the
// user's timezone. start carries an explicit offset, end is the UTC equivalent —
// both encode a single instant, so Google and the DB agree without timezone drift.
function buildScheduleInstants(date: string, time: string, durationMinutes: number, timezone: string) {
  const offset = timezoneOffset(date, timezone);
  const startAt = `${date}T${time}:00${offset}`;
  const endAt = addMinutesIso(startAt, durationMinutes);
  return { startAt, endAt };
}

const DAY_TOKEN_TO_INDEX: Record<string, number> = {
  su: 0, sun: 0, sunday: 0, domingo: 0,
  mo: 1, mon: 1, monday: 1, segunda: 1,
  tu: 2, tue: 2, tuesday: 2, terca: 2, terça: 2,
  we: 3, wed: 3, wednesday: 3, quarta: 3,
  th: 4, thu: 4, thursday: 4, quinta: 4,
  fr: 5, fri: 5, friday: 5, sexta: 5,
  sa: 6, sat: 6, saturday: 6, sabado: 6, sábado: 6,
};

// Turn a free-form recurrence preference ("weekends", "seg, qua, sex", ["MO","WE"])
// into weekday indices, reusing the planner's cadence vocabulary for phrases.
function normalizeRecurrenceDays(input: string | string[]): number[] {
  const tokens = Array.isArray(input) ? input : input.split(/[,\s]+/);
  const explicit = tokens
    .map(token => DAY_TOKEN_TO_INDEX[token.trim().toLowerCase()])
    .filter((day): day is number => typeof day === 'number');
  if (explicit.length > 0) return Array.from(new Set(explicit)).sort((a, b) => a - b);
  const phrase = Array.isArray(input) ? input.join(' ') : input;
  return resolveCadence(phrase).daysOfWeek;
}

function recurrenceUntilDate(goalDue: string | null | undefined): string {
  if (goalDue) return goalDue.slice(0, 10);
  return `${new Date().getUTCFullYear() + 1}-12-31`;
}

function calendarTimesForOccurrence(task: CalendarOccurrence, timezone: string) {
  const startAt = task.start_at || defaultStartIso(task.scheduled_date, timezone);
  const duration = task.duration_minutes || 30;
  return {
    startAt,
    endAt: task.end_at || addMinutesIso(startAt, duration),
  };
}

async function createCalendarEventsForOccurrences(
  context: ToolContext,
  account: GoogleAccount,
  occurrences: CalendarOccurrence[],
  onCreated?: (eventId: string) => void,
): Promise<CreatedCalendarEventForOccurrence[]> {
  const created: CreatedCalendarEventForOccurrence[] = [];
  for (const occurrence of occurrences) {
    const times = calendarTimesForOccurrence(occurrence, context.timezone || 'UTC');
    const event = await createCalendarEvent(account.id, {
      title: occurrence.title,
      description: occurrence.description || undefined,
      startAt: times.startAt,
      endAt: times.endAt,
      recurrence: occurrence.recurrence || undefined,
    }, context);
    onCreated?.(event.id);
    created.push({
      title: occurrence.title,
      provider_event_id: event.id,
      html_link: event.htmlLink,
      start_at: times.startAt,
      end_at: times.endAt,
      occurrence,
    });
  }
  return created;
}

async function rollbackCalendarEvents(accountId: string, eventIds: string[], context: ToolContext) {
  for (const eventId of eventIds) {
    try {
      await deleteCalendarEvent(accountId, eventId, context);
    } catch (error) {
      console.error('Google Calendar rollback failed:', { eventId, error });
    }
  }
}

export const goalsListTool = defineTool({
  name: 'goals.list',
  description: `List the user's goals and active action plans. Read-only.

WHEN TO USE:
- The user asks about goals, yearly/monthly/weekly progress, active plans, or what they are working toward.
- Before creating a short-term action plan that may affect an existing long-term goal.
- Before updating a plan, so you know the current structure.

CONTRACT:
- Optional filters for timeframe/status.
- include_action_plans defaults true.
- Do not read raw IDs aloud. Use titles/statuses in the final response.`,
  isReadOnly: true,
  inputSchema: z.object({
    timeframe: goalTimeframeSchema.optional(),
    status: goalStatusSchema.optional(),
    include_action_plans: z.boolean().optional().default(true),
  }),
  call: async (args, context) => {
    let goalsQuery = context.supabase
      .from('smart_goals')
      .select(GOAL_FIELDS)
      .eq('user_id', context.user.id)
      .order('target_date', { ascending: true })
      .order('created_at', { ascending: false });

    if (args.timeframe) goalsQuery = goalsQuery.eq('timeframe', args.timeframe);
    if (args.status) goalsQuery = goalsQuery.eq('status', args.status);

    const { data: goals, error: goalsError } = await goalsQuery;
    if (goalsError) return { ok: false, error: goalsError.message || 'Failed to list goals' };

    let actionPlans: unknown[] = [];
    if (args.include_action_plans) {
      const { data, error } = await context.supabase
        .from('action_plans')
        .select(ACTION_PLAN_FIELDS)
        .eq('user_id', context.user.id)
        .in('status', ['not_started', 'in_progress'])
        .order('review_date', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) return { ok: false, error: error.message || 'Failed to list action plans' };
      actionPlans = data || [];
    }

    return {
      ok: true,
      receipt: {
        goals: goals || [],
        action_plans: actionPlans,
        goal_count: (goals || []).length,
        action_plan_count: actionPlans.length,
      },
    };
  },
});

export const goalsCreateOperatingPlanTool = defineTool({
  name: 'goals.create_operating_plan',
  description: `Create a long-term Goal Operating System: persistent yearly/monthly/weekly goal records + a short action plan sprint + Google Calendar recurring series through the goal target date.

CONCEPTS — understand before calling:
- GOAL: a long-term objective (yearly/monthly/weekly). Lives in the Goals page. Never expires until the user achieves or cancels it.
- ACTION PLAN: a short execution sprint (max 21 days) that works toward a goal. When its review_date arrives it should be renewed. It is NOT the goal itself.
- TASKS: concrete preview occurrences inside the action plan window.
- CALENDAR EVENTS: recurring Google Calendar series that run from the plan start date through the goal target date.

WHEN TO USE:
- The user explicitly accepts a goal proposal.
- The user asks to turn a yearly goal into monthly/weekly/day execution.

CONTRACT — cadence rules (CRITICAL — apply exactly):
- "finais de semana" / "weekends" → Saturday (6) and Sunday (0) ONLY. Never weekdays.
- "dias úteis" / "weekdays" → Monday–Friday (1–5) ONLY. Never weekends.
- Named days ("segunda", "monday", etc.) → only those exact days.
- No cadence mentioned → infer daily but WARN and ask user to confirm before calling.
- execution_window_days defaults to 14. Max is 21. This only controls the concrete preview/action-plan window, not the Google Calendar recurrence length.
- NEVER schedule tasks on days that don't match the cadence.
- If different day groups have different times, include both in weekly_routine; the planner will create separate recurring series (for example weekdays at 21:00 and weekends at 10:00).

CALENDAR EVENTS:
- This tool itself creates one Google Calendar recurring event series for each unique schedule rule.
- Do NOT call calendar.create_event again after this tool succeeds; that would duplicate events.
- If no preferred_time was given, this tool uses a default 09:00 start time in the user's timezone.

ASK BEFORE CALLING IF: goal is vague, cadence is ambiguous, or user hasn't confirmed the proposal.

CORRECT CALL SHAPE (all fields are TOP-LEVEL — never nest them):
{
  "annual_smart_goal": "Reach R$10.000 monthly revenue by December 2026",
  "monthly_milestone": "Close first paying client in May",
  "weekly_routine": "Dedicar os finais de semana ao desenvolvimento do produto",
  "execution_window_days": 14
}`,
  isReadOnly: false,
  inputSchema: z.preprocess((raw: any) => {
    if (!raw || typeof raw !== 'object') return raw;
    // Normalise field aliases Gemini sometimes uses
    return {
      ...raw,
      annual_smart_goal:  raw.annual_smart_goal  ?? raw.goal             ?? raw.annual_goal     ?? raw.yearly_goal   ?? raw.smart_goal ?? undefined,
      monthly_milestone:  raw.monthly_milestone   ?? raw.monthly_goal     ?? raw.milestone       ?? raw.monthly       ?? undefined,
      weekly_routine:     raw.weekly_routine      ?? raw.routine          ?? raw.weekly_schedule ?? raw.weekly        ?? undefined,
      preferred_time:     normalizePreferredTime(raw.preferred_time ?? raw.time ?? raw.start_time ?? undefined),
    };
  }, z.object({
    annual_smart_goal:           z.string().min(8).max(1000).describe('The full yearly SMART goal as a plain string. Example: "Reach R$10.000 monthly revenue by December 2026". REQUIRED. Pass directly — do NOT nest inside another object.'),
    monthly_milestone:           z.string().min(4).max(1000).describe('The first monthly milestone as a plain string. REQUIRED. Pass directly.'),
    weekly_routine:              z.string().min(4).max(1000).describe('The recurring weekly execution routine as a plain string, including cadence words (e.g. "finais de semana", "weekdays"). REQUIRED. Pass directly.'),
    start_date:                  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('ISO date YYYY-MM-DD when the plan starts. Defaults to today.'),
    target_date:                 z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('ISO date YYYY-MM-DD for the yearly goal deadline. Defaults to Dec 31 of this year.'),
    preferred_time:              z.string().regex(/^\d{2}:\d{2}$/).optional().describe('Preferred start time for tasks in HH:MM (24h). Optional — if omitted, tasks are flexible.'),
    default_task_duration_minutes: z.number().min(1).max(240).optional().describe('Duration in minutes for each task occurrence. Defaults to 15.'),
    execution_window_days:       z.number().min(1).max(21).optional().describe('How many calendar days to materialise preview tasks for. Defaults to 14. Max 21. Calendar events recur through target_date.'),
    calendar_account_nickname:   z.string().optional().describe('Google Calendar account nickname/name. Required when the user has more than one active Google account.'),
  })),
  call: async (args, context) => {
    let result: Awaited<ReturnType<typeof persistGoalOperatingPlan>> | null = null;
    let accountId: string | null = null;
    const createdGoogleEventIds: string[] = [];
    try {
      const account = await resolveGoogleCalendarAccount(context, args.calendar_account_nickname);
      if (!account.ok) return { ok: false, error: account.error };
      accountId = account.account.id;

      result = await persistGoalOperatingPlan(context.supabase, context.user.id, args);
      const tasks = result.plan.recurring_events.map(task => ({
        title: task.title,
        description: task.description,
        scheduled_date: task.scheduled_date,
        start_at: task.start_at,
        end_at: task.end_at,
        duration_minutes: task.duration_minutes,
        recurrence: task.recurrence,
        action_plan_id: result?.persisted.action_plan.id,
        goal_id: result?.persisted.goals.weekly.id,
        plan_day: null,
        sort_order: 0,
      }));
      const calendarEvents = await createCalendarEventsForOccurrences(
        context,
        account.account,
        tasks,
        eventId => createdGoogleEventIds.push(eventId),
      );
      await recordGoalCalendarEventLinks(context.supabase, context.user.id, calendarEvents.map(event => ({
        linked_account_id: account.account.id,
        provider_event_id: event.provider_event_id,
        action_plan_id: event.occurrence.action_plan_id || result!.persisted.action_plan.id,
        goal_id: event.occurrence.goal_id || result!.persisted.goals.weekly.id,
        title: event.title,
        scheduled_date: event.occurrence.scheduled_date,
        start_at: event.start_at,
        end_at: event.end_at,
        duration_minutes: event.occurrence.duration_minutes || 30,
        recurrence: event.occurrence.recurrence ?? null,
        plan_day: event.occurrence.plan_day,
        sort_order: event.occurrence.sort_order,
      })));
      const receiptCalendarEvents = calendarEvents.map(({ occurrence, ...event }) => event);
      return {
        ok: true,
        receipt: {
          goals_created: 3,
          action_plan_created: true,
          calendar_events_created: receiptCalendarEvents.length,
          recurring_series_created: receiptCalendarEvents.length,
          first_task_date: result.plan.active_tasks[0]?.scheduled_date || null,
          review_date: result.plan.action_plan.review_date,
          cadence_summary: result.plan.future_work_template.cadence_summary,
          execution_window_days: result.plan.future_work_template.concrete_window_days,
          scheduled_dates: tasks.map(t => ({
            date: t.scheduled_date,
            start_at: t.start_at || null,
            end_at: t.end_at || null,
            title: t.title,
          })),
          calendar_events: receiptCalendarEvents,
          warnings: result.plan.warnings,
          summary: `Goal created. ${calendarEvents.length} Google Calendar recurring series scheduled through the goal target date (${result.plan.future_work_template.cadence_summary}). Action plan renews on ${result.plan.action_plan.review_date}.`,
        },
      };
    } catch (error) {
      if (accountId && createdGoogleEventIds.length > 0) {
        await rollbackCalendarEvents(accountId, createdGoogleEventIds, context);
      }
      if (result) {
        await cleanupPersistedGoalOperatingPlan(context.supabase, context.user.id, result.persisted);
      }
      return { ok: false, error: error instanceof Error ? error.message : 'Failed to create goal operating plan' };
    }
  },
});

export const goalsListDeletedCalendarEventsTool = defineTool({
  name: 'goals.list_deleted_calendar_events',
  description: `Lists deleted calendar events that were originally created for goals or action plans and may need rescheduling.

WHEN TO USE:
- The user asks what needs to be replanned after deleting a goal event.
- The user asks Balys to remanejar/replanejar horas, tasks, or calendar blocks for goals.
- After calendar.delete_event or calendar.delete_events_batch returns goal_event_impact.needs_replan=true.

CONTRACT:
- This is read-only. It does not create new events.
- Use the human-facing title/date/duration in the final response, never IDs.
- If the user wants to reschedule, list the affected block and ask where to move it unless their instruction is already specific.`,
  isReadOnly: true,
  inputSchema: z.object({
    limit: z.number().min(1).max(50).optional().default(20),
  }),
  call: async (args, context) => {
    try {
      const deletedEvents = await listDeletedGoalCalendarEvents(context.supabase, context.user.id, args.limit);
      return {
        ok: true,
        receipt: {
          deleted_events: deletedEvents,
          needs_replan_count: deletedEvents.length,
          summary: deletedEvents.length === 0
            ? 'No deleted goal calendar events need replanning.'
            : `${deletedEvents.length} deleted goal calendar event(s) need a replanning decision.`,
        },
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Failed to list deleted goal calendar events' };
    }
  },
});

export const goalsCreateShortActionPlanTool = defineTool({
  name: 'goals.create_short_action_plan',
  description: `Persist a short-term action plan (plano de ação) that the user has ALREADY accepted after a clarifying conversation.

WHAT IS A PLANO DE AÇÃO:
- A sprint of 1–21 days to solve ONE specific, concrete problem or execute a specific step.
- It is NOT a goal (meta). It does NOT replace or reuse the user's yearly goal.
- The title and tasks must reflect the SPECIFIC problem the user described, not a recycled goal title.

MANDATORY BEFORE CALLING:
1. You must have asked the user: what specific problem, how many days, what concrete tasks.
2. You must have presented a structured proposal and received EXPLICIT acceptance.
3. NEVER call this tool speculatively or with recycled goal data.
4. If goals.list was needed to check existing goals, call it first.

CONTRACT:
- duration_days max 21. If user wants more, create multiple plans or suggest a meta instead.
- Every task must have a specific scheduled_date within the plan window.
- This tool itself creates one Google Calendar event for every task.
- Do NOT call calendar.create_event again after this tool succeeds; that would duplicate events.
- If the user has not provided concrete tasks yet, ask for them before calling this tool.

WRONG (never do this): recycling an existing goal title like "Atingir R$10k" as the action plan title.
RIGHT: a concrete sprint title like "Criar landing page do produto — 7 dias" or "Contatar 10 clientes potenciais esta semana".`,
  isReadOnly: false,
  inputSchema: z.preprocess((raw: any) => {
    if (!raw || typeof raw !== 'object') return raw;
    // Normalise field aliases Gemini sometimes uses instead of the canonical names
    return {
      ...raw,
      // problem_statement aliases
      problem_statement: raw.problem_statement ?? raw.description ?? raw.problem ?? raw.statement ?? raw.context ?? undefined,
      // title aliases
      title: raw.title ?? raw.name ?? raw.plan_title ?? undefined,
      // tasks aliases
      tasks: raw.tasks ?? raw.task_list ?? raw.steps ?? raw.activities ?? [],
    };
  }, z.object({
    title: z.string().min(3).max(180),
    problem_statement: z.string().min(8).max(1200),
    linked_goal_ids: z.array(z.string().min(1)).max(8).optional(),
    duration_days: z.number().min(1).max(21).optional().default(14),
    starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    success_criteria: z.string().max(1000).optional(),
    calendar_account_nickname: z.string().optional().describe('Google Calendar account nickname/name. Required when the user has more than one active Google account.'),
    tasks: z.array(z.object({
      title: z.string().min(3).max(180),
      description: z.string().max(800).optional(),
      scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      start_at: z.string().optional().describe('ISO-like datetime. Timezone offset preferred; if omitted, app timezone/default handling is used.'),
      end_at: z.string().optional().describe('ISO-like datetime after start_at. Timezone offset preferred.'),
      duration_minutes: z.number().min(1).max(240).optional().default(5),
    })).min(1).max(366),
  })),
  call: async (args, context) => {
    const account = await resolveGoogleCalendarAccount(context, args.calendar_account_nickname);
    if (!account.ok) return { ok: false, error: account.error };
    const createdGoogleEventIds: string[] = [];

    const linkedGoalIds = Array.from(new Set(args.linked_goal_ids || []));
    const startsOn = args.starts_on || context.nowIso.slice(0, 10);
    const durationDays = args.duration_days ?? 14;
    const taskInputs = args.tasks || [];
    const reviewDate = args.review_date || addDays(startsOn, durationDays);
    const created: { actionPlanId: string | null } = { actionPlanId: null };

    try {
      const { data: actionPlan, error: actionPlanError } = await context.supabase
        .from('action_plans')
        .insert({
          user_id: context.user.id,
          title: args.title.trim(),
          description: args.problem_statement.trim(),
          problem_statement: args.problem_statement.trim(),
          linked_goal_id: linkedGoalIds[0] || null,
          linked_goal_ids: linkedGoalIds,
          plan_type: 'short_term_problem',
          status: 'in_progress',
          duration_days: durationDays,
          starts_on: startsOn,
          review_date: reviewDate,
          success_criteria: args.success_criteria?.trim() || null,
        })
        .select(ACTION_PLAN_FIELDS)
        .single();

      if (actionPlanError) throw actionPlanError;
      created.actionPlanId = actionPlan.id;

      if (linkedGoalIds.length > 0) {
        const { error: linksError } = await context.supabase
          .from('action_plan_goal_links')
          .insert(linkedGoalIds.map(goalId => ({
            user_id: context.user.id,
            action_plan_id: actionPlan.id,
            goal_id: goalId,
          })));
        if (linksError) throw linksError;
      }

      let calendarEvents: Array<{ title: string; provider_event_id: string; html_link: string; start_at: string; end_at: string }> = [];
      if (taskInputs.length > 0) {
        const occurrences = taskInputs.map((task, index) => {
          const scheduledDate = task.scheduled_date || addDays(startsOn, index);
          const duration = task.duration_minutes || inferDurationMinutes(task.start_at, task.end_at) || 5;
          return {
            title: task.title.trim(),
            description: task.description?.trim() || null,
            scheduled_date: scheduledDate,
            start_at: task.start_at || `${scheduledDate}T09:00:00.000Z`,
            end_at: task.end_at || null,
            duration_minutes: duration,
            action_plan_id: actionPlan.id,
            goal_id: linkedGoalIds[0] || null,
            plan_day: index + 1,
            sort_order: index * 10,
          };
        });
        const createdCalendarEvents = await createCalendarEventsForOccurrences(
          context,
          account.account,
          occurrences,
          eventId => createdGoogleEventIds.push(eventId),
        );
        await recordGoalCalendarEventLinks(context.supabase, context.user.id, createdCalendarEvents
          .filter(event => event.occurrence.action_plan_id && event.occurrence.goal_id)
          .map(event => ({
            linked_account_id: account.account.id,
            provider_event_id: event.provider_event_id,
            action_plan_id: event.occurrence.action_plan_id!,
            goal_id: event.occurrence.goal_id!,
            title: event.title,
            scheduled_date: event.occurrence.scheduled_date,
            start_at: event.start_at,
            end_at: event.end_at,
            duration_minutes: event.occurrence.duration_minutes || 30,
            plan_day: event.occurrence.plan_day,
            sort_order: event.occurrence.sort_order,
          })));
        calendarEvents = createdCalendarEvents.map(({ occurrence, ...event }) => event);
      }

      const flexibleEventCount = taskInputs.filter(task => !task.start_at).length;
      return {
        ok: true,
        receipt: {
          action_plan: actionPlan,
          calendar_events_created: calendarEvents.length,
          linked_goal_count: linkedGoalIds.length,
          calendar_events: calendarEvents,
          warnings: flexibleEventCount > 0
            ? [`${flexibleEventCount} Google Calendar event(s) used the default 09:00 start time because no start time was provided.`]
            : [],
          summary: `Created a short-term action plan with ${calendarEvents.length} Google Calendar event(s).`,
        },
      };
    } catch (error) {
      await rollbackCalendarEvents(account.account.id, createdGoogleEventIds, context);
      await cleanupShortActionPlan(context.supabase, context.user.id, created);
      return { ok: false, error: error instanceof Error ? error.message : 'Failed to create short-term action plan' };
    }
  },
});

async function selectLinkedEvents(
  context: ToolContext,
  opts: {
    providerEventIds?: string[] | null;
    goalId?: string | null;
    actionPlanId?: string | null;
    all?: boolean;
    statuses: GoalCalendarEventStatus[];
  },
): Promise<GoalCalendarEvent[]> {
  if (opts.providerEventIds && opts.providerEventIds.length > 0) {
    return listGoalCalendarEvents(context.supabase, context.user.id, { providerEventIds: opts.providerEventIds, statuses: opts.statuses });
  }
  if (opts.goalId) {
    return listGoalCalendarEvents(context.supabase, context.user.id, { goalId: opts.goalId, statuses: opts.statuses });
  }
  if (opts.actionPlanId) {
    return listGoalCalendarEvents(context.supabase, context.user.id, { actionPlanId: opts.actionPlanId, statuses: opts.statuses });
  }
  if (opts.all) {
    return listGoalCalendarEvents(context.supabase, context.user.id, { statuses: opts.statuses });
  }
  return [];
}

export const goalsListCalendarEventsTool = defineTool({
  name: 'goals.list_calendar_events',
  description: `Lists the Google Calendar events that belong to a goal or action plan, including ones that were DELETED. Read-only.

WHEN TO USE:
- The user asks about a specific goal/plan and whether its blocks still exist ("o que aconteceu com os horários da minha meta?", "did you delete my study sessions?").
- BEFORE goals.reschedule_calendar_events, goals.restore_calendar_events, or goals.delete_plan, to resolve which events (and their internal ids) are affected.
- To explain that an event existed and was deleted: deleted rows are returned with status 'deleted'.

CONTRACT:
- Pass goal_id or action_plan_id (resolve them first with goals.list). Omit both to list every goal/plan event.
- include_deleted defaults true so you can see and explain removals.
- Read-only. provider_event_id is TECHNICAL — keep it to chain into the write tools, never read it aloud.
- Use titles/dates/status in the final reply. status values: active, rescheduled, moved, deleted.`,
  isReadOnly: true,
  inputSchema: z.object({
    goal_id: z.string().optional(),
    action_plan_id: z.string().optional(),
    include_deleted: z.boolean().optional().default(true),
    limit: z.number().min(1).max(200).optional().default(100),
  }),
  call: async (args, context) => {
    try {
      const statuses: GoalCalendarEventStatus[] | undefined = args.include_deleted
        ? undefined
        : ['active', 'rescheduled', 'moved'];
      const events = await listGoalCalendarEvents(context.supabase, context.user.id, {
        goalId: args.goal_id,
        actionPlanId: args.action_plan_id,
        statuses,
        limit: args.limit,
      });
      const activeCount = events.filter(e => e.status !== 'deleted').length;
      const deletedCount = events.filter(e => e.status === 'deleted').length;
      return {
        ok: true,
        receipt: {
          events: events.map(event => ({
            provider_event_id: event.provider_event_id,
            title: event.title,
            scheduled_date: event.scheduled_date,
            start_at: event.start_at,
            end_at: event.end_at,
            status: event.status,
            is_recurring: Array.isArray(event.recurrence) && event.recurrence.length > 0,
            goal_id: event.goal_id,
            action_plan_id: event.action_plan_id,
            deleted_at: event.deleted_at,
          })),
          active_count: activeCount,
          deleted_count: deletedCount,
          summary: deletedCount > 0
            ? `${activeCount} active and ${deletedCount} deleted goal/plan calendar event(s).`
            : `${activeCount} active goal/plan calendar event(s).`,
        },
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Failed to list goal calendar events' };
    }
  },
});

export const goalsRescheduleCalendarEventsTool = defineTool({
  name: 'goals.reschedule_calendar_events',
  description: `Remanejar (reschedule) the Google Calendar events of a goal or action plan: change the time of day and/or which weekdays a recurring series runs. Keeps the goal/plan link in sync.

WHEN TO USE:
- "remaneja meus horários de estudo para 21h", "move the workout block to weekends", "muda a recorrência da meta para dias úteis".
- Reschedule ALL of a goal/plan's events, a specific goal/plan, or specific events.

CONTRACT:
- Choose the target: goal_id, action_plan_id, provider_event_ids (from goals.list_calendar_events), or apply_to_all=true for every goal/plan event. Resolve goal_id/action_plan_id with goals.list first.
- Provide at least one change: new_time (HH:MM, 24h) and/or new_recurrence_days.
- new_recurrence_days accepts natural cadence ("weekends", "dias úteis", "segunda, quarta, sexta") or weekday tokens (MO,TU,...). It only changes recurring series; one-off events keep their single date and are just moved in time.
- new_time preserves each event's duration. Times resolve in the user's timezone.
- Only active events are rescheduled. To bring back a deleted event use goals.restore_calendar_events first.

RETURNS receipt: { rescheduled_count, failed_count, results[], summary }. Read summary before replying; report failures honestly. Confirm in human terms ("Movi seus blocos de estudo para as nove da noite"), never read IDs.`,
  isReadOnly: false,
  inputSchema: z.object({
    goal_id: z.string().optional(),
    action_plan_id: z.string().optional(),
    provider_event_ids: z.array(z.string()).max(50).optional(),
    apply_to_all: z.boolean().optional(),
    new_time: z.string().regex(/^\d{2}:\d{2}$/).optional().describe('New start time of day in HH:MM (24h). Duration is preserved.'),
    new_recurrence_days: z.string().optional().describe('New cadence for recurring series: a phrase ("weekends", "dias úteis") or weekday tokens ("MO,WE,FR").'),
    calendar_account_nickname: z.string().optional(),
  }),
  call: async (args, context) => {
    if (!args.new_time && !args.new_recurrence_days) {
      return { ok: false, error: 'Provide new_time and/or new_recurrence_days to reschedule.' };
    }
    if (!args.provider_event_ids?.length && !args.goal_id && !args.action_plan_id && !args.apply_to_all) {
      return { ok: false, error: 'Specify which events to reschedule: goal_id, action_plan_id, provider_event_ids, or apply_to_all.' };
    }

    const account = await resolveGoogleCalendarAccount(context, args.calendar_account_nickname);
    if (!account.ok) return { ok: false, error: account.error };
    const tz = context.timezone || 'UTC';

    const events = await selectLinkedEvents(context, {
      providerEventIds: args.provider_event_ids,
      goalId: args.goal_id,
      actionPlanId: args.action_plan_id,
      all: args.apply_to_all,
      statuses: ['active', 'rescheduled', 'moved'],
    });
    if (events.length === 0) {
      return { ok: true, receipt: { rescheduled_count: 0, failed_count: 0, results: [], summary: 'No active goal or plan calendar events matched the request.' } };
    }

    let recurrenceDays: number[] | null = null;
    const dueByGoalId = new Map<string, string | null>();
    if (args.new_recurrence_days) {
      recurrenceDays = normalizeRecurrenceDays(args.new_recurrence_days);
      if (recurrenceDays.length === 0) {
        return { ok: false, error: `Could not understand the recurrence days "${args.new_recurrence_days}".` };
      }
      const goalIds = Array.from(new Set(events.map(e => e.goal_id).filter((id): id is string => Boolean(id))));
      if (goalIds.length > 0) {
        const { data } = await context.supabase
          .from('smart_goals')
          .select('id, due_on, target_date')
          .eq('user_id', context.user.id)
          .in('id', goalIds);
        for (const goal of (data || []) as Array<{ id: string; due_on?: string | null; target_date?: string | null }>) {
          dueByGoalId.set(goal.id, goal.due_on || goal.target_date || null);
        }
      }
    }

    const results = [] as Array<{ title: string; status: 'rescheduled' | 'failed'; recurrence_changed?: boolean; recurrence_skipped?: boolean; error?: string }>;
    for (const event of events) {
      try {
        const isRecurring = Array.isArray(event.recurrence) && event.recurrence.length > 0;
        let scheduledDate = event.scheduled_date;
        let recurrence: string[] | undefined;
        if (recurrenceDays && isRecurring) {
          scheduledDate = firstMatchingDate(event.scheduled_date, recurrenceDays);
          recurrence = [weeklyRRule(recurrenceDays, recurrenceUntilDate(event.goal_id ? dueByGoalId.get(event.goal_id) : null))];
        }
        const time = args.new_time || wallClockTimeInTz(event.start_at, tz);
        const { startAt, endAt } = buildScheduleInstants(scheduledDate, time, event.duration_minutes || 30, tz);

        await updateCalendarEvent(account.account.id, event.provider_event_id, { startAt, endAt, recurrence }, context);
        await updateGoalCalendarEventSchedule(context.supabase, context.user.id, {
          linkedAccountId: account.account.id,
          providerEventId: event.provider_event_id,
          startAt: new Date(startAt).toISOString(),
          endAt,
          scheduledDate,
          recurrence: recurrence ?? undefined,
          status: 'rescheduled',
        });
        results.push({
          title: event.title,
          status: 'rescheduled',
          recurrence_changed: Boolean(recurrence),
          recurrence_skipped: Boolean(recurrenceDays && !isRecurring),
        });
      } catch (e: any) {
        const googleMsg = e?.response?.data?.error?.message || e?.errors?.[0]?.message || e?.message;
        results.push({ title: event.title, status: 'failed', error: googleMsg || 'Failed to reschedule event' });
      }
    }

    const rescheduled_count = results.filter(r => r.status === 'rescheduled').length;
    const failed_count = results.length - rescheduled_count;
    const skippedRecurrence = results.some(r => r.status === 'rescheduled' && r.recurrence_skipped);
    let summary: string;
    if (failed_count === 0) {
      summary = `Rescheduled ${rescheduled_count} event(s).`;
    } else if (rescheduled_count === 0) {
      summary = `Could not reschedule any of the ${results.length} event(s). Reasons: ${results.filter(r => r.error).map(r => r.error).slice(0, 3).join('; ')}.`;
    } else {
      summary = `Rescheduled ${rescheduled_count} of ${results.length}; ${failed_count} failed: ${results.filter(r => r.error).map(r => r.error).slice(0, 3).join('; ')}.`;
    }
    if (skippedRecurrence) summary += ' Some one-off events kept their single date (recurrence applies only to recurring series).';

    return { ok: true, receipt: { rescheduled_count, failed_count, results, summary } };
  },
});

export const goalsRestoreCalendarEventsTool = defineTool({
  name: 'goals.restore_calendar_events',
  description: `Restore goal/action-plan calendar events that were previously deleted, recreating them on Google Calendar with their original time and recurrence.

WHEN TO USE:
- "desfaz, recoloca aquele evento", "restore my study sessions", "traz de volta os blocos que você apagou".
- After goals.list_calendar_events / goals.list_deleted_calendar_events shows deleted blocks the user wants back.

CONTRACT:
- Choose the target: provider_event_ids (the deleted ids from goals.list_calendar_events), goal_id, action_plan_id, or apply_to_all_deleted=true.
- Restored events get a NEW underlying calendar entry but reappear with the same title, time, and cadence.
- If nothing matches the selection, report that there was nothing to restore.

RETURNS receipt: { restored_count, failed_count, results[], summary }. Confirm in human terms; never read IDs.`,
  isReadOnly: false,
  inputSchema: z.object({
    goal_id: z.string().optional(),
    action_plan_id: z.string().optional(),
    provider_event_ids: z.array(z.string()).max(50).optional(),
    apply_to_all_deleted: z.boolean().optional(),
    calendar_account_nickname: z.string().optional(),
  }),
  call: async (args, context) => {
    if (!args.provider_event_ids?.length && !args.goal_id && !args.action_plan_id && !args.apply_to_all_deleted) {
      return { ok: false, error: 'Specify which deleted events to restore: goal_id, action_plan_id, provider_event_ids, or apply_to_all_deleted.' };
    }
    const account = await resolveGoogleCalendarAccount(context, args.calendar_account_nickname);
    if (!account.ok) return { ok: false, error: account.error };

    const deletedEvents = await selectLinkedEvents(context, {
      providerEventIds: args.provider_event_ids,
      goalId: args.goal_id,
      actionPlanId: args.action_plan_id,
      all: args.apply_to_all_deleted,
      statuses: ['deleted'],
    });
    if (deletedEvents.length === 0) {
      return { ok: true, receipt: { restored_count: 0, failed_count: 0, results: [], summary: 'No deleted goal or plan calendar events matched the request.' } };
    }

    const results = [] as Array<{ title: string; status: 'restored' | 'failed'; html_link?: string; error?: string }>;
    for (const event of deletedEvents) {
      try {
        const created = await createCalendarEvent(account.account.id, {
          title: event.title,
          startAt: event.start_at,
          endAt: event.end_at,
          recurrence: event.recurrence || undefined,
        }, context);
        await restoreGoalCalendarEvent(context.supabase, context.user.id, {
          linkedAccountId: account.account.id,
          oldProviderEventId: event.provider_event_id,
          newProviderEventId: created.id,
          startAt: event.start_at,
          endAt: event.end_at,
          scheduledDate: event.scheduled_date,
          recurrence: event.recurrence,
        });
        results.push({ title: event.title, status: 'restored', html_link: created.htmlLink });
      } catch (e: any) {
        const googleMsg = e?.response?.data?.error?.message || e?.errors?.[0]?.message || e?.message;
        results.push({ title: event.title, status: 'failed', error: googleMsg || 'Failed to restore event' });
      }
    }

    const restored_count = results.filter(r => r.status === 'restored').length;
    const failed_count = results.length - restored_count;
    let summary: string;
    if (failed_count === 0) {
      summary = `Restored ${restored_count} event(s).`;
    } else if (restored_count === 0) {
      summary = `Could not restore any of the ${results.length} event(s). Reasons: ${results.filter(r => r.error).map(r => r.error).slice(0, 3).join('; ')}.`;
    } else {
      summary = `Restored ${restored_count} of ${results.length}; ${failed_count} failed: ${results.filter(r => r.error).map(r => r.error).slice(0, 3).join('; ')}.`;
    }

    return { ok: true, receipt: { restored_count, failed_count, results, summary } };
  },
});

export const goalsDeletePlanTool = defineTool({
  name: 'goals.delete_plan',
  description: `Delete a GOAL (meta) or an ACTION PLAN (plano de ação) entirely, including its Google Calendar events. DESTRUCTIVE.

WHEN TO USE:
- "apaga essa meta", "cancela o plano de ação", "não quero mais essa meta nem os eventos dela".

CONTRACT:
- Pass goal_id OR action_plan_id (never both). Resolve the id with goals.list first.
- Deleting a goal also removes its monthly/weekly sub-goals, its linked action plans, their tasks, and all of their calendar events.
- delete_calendar_events defaults true (also cancels the Google events). Set false to keep the calendar blocks but drop the goal/plan.
- ALWAYS confirm with the user before calling — this cannot be undone (deleted events can be restored only if they still exist in tracking; the goal/plan records are gone for good).

RETURNS receipt: { deleted_kind, calendar_events_deleted, calendar_events_failed, summary }. Confirm in human terms; never read IDs.`,
  isReadOnly: false,
  inputSchema: z.object({
    goal_id: z.string().optional(),
    action_plan_id: z.string().optional(),
    delete_calendar_events: z.boolean().optional().default(true),
  }),
  call: async (args, context) => {
    if (!args.goal_id && !args.action_plan_id) {
      return { ok: false, error: 'Specify which goal or action plan to delete (goal_id or action_plan_id).' };
    }
    if (args.goal_id && args.action_plan_id) {
      return { ok: false, error: 'Delete a goal OR an action plan, not both in the same call.' };
    }

    try {
      const goalTargets = args.goal_id
        ? await gatherGoalDeletionTargets(context.supabase, context.user.id, args.goal_id)
        : null;
      const planTargets = args.action_plan_id
        ? await gatherActionPlanDeletionTargets(context.supabase, context.user.id, args.action_plan_id)
        : null;
      const calendarEvents = goalTargets?.calendar_events ?? planTargets?.calendar_events ?? [];

      let deletedEvents = 0;
      let failedEvents = 0;
      if (args.delete_calendar_events) {
        const liveEvents = calendarEvents.filter(event => event.status !== 'deleted');
        const eventResults = await Promise.all(liveEvents.map(async (event) => {
          try {
            await deleteCalendarEvent(event.linked_account_id, event.provider_event_id, context);
            return true;
          } catch (error) {
            console.error('[goals.delete_plan] calendar event delete failed:', error);
            return false;
          }
        }));
        deletedEvents = eventResults.filter(Boolean).length;
        failedEvents = eventResults.length - deletedEvents;
      }

      let deletedKind: 'goal' | 'action_plan';
      if (goalTargets) {
        await deleteGoalRecords(context.supabase, context.user.id, goalTargets);
        deletedKind = 'goal';
      } else {
        await deleteActionPlanRecords(context.supabase, context.user.id, [args.action_plan_id!]);
        deletedKind = 'action_plan';
      }

      return {
        ok: true,
        receipt: {
          deleted_kind: deletedKind,
          calendar_events_deleted: deletedEvents,
          calendar_events_failed: failedEvents,
          summary: `Deleted the ${deletedKind === 'goal' ? 'goal and everything under it' : 'action plan'}.${args.delete_calendar_events ? ` Removed ${deletedEvents} calendar event(s)${failedEvents > 0 ? `, ${failedEvents} could not be cancelled` : ''}.` : ' Kept the existing calendar events.'}`,
        },
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Failed to delete the goal or action plan' };
    }
  },
});

async function cleanupShortActionPlan(
  supabase: any,
  userId: string,
  created: { actionPlanId: string | null },
) {
  try {
    if (created.actionPlanId) {
      await supabase.from('action_plan_goal_links').delete().eq('user_id', userId).eq('action_plan_id', created.actionPlanId);
      await supabase.from('action_plans').delete().eq('user_id', userId).eq('id', created.actionPlanId);
    }
  } catch (error) {
    console.error('Short action plan cleanup failed:', error);
  }
}

function inferDurationMinutes(startAt?: string | null, endAt?: string | null): number | null {
  if (!startAt || !endAt) return null;
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.max(1, Math.ceil((end - start) / 60000));
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
