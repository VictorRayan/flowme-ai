import { z } from 'zod';
import { defineTool, ToolContext } from './Tool';
import { listDeletedGoalCalendarEvents, recordGoalCalendarEventLinks } from '@/lib/goals/calendar-event-links';
import { cleanupPersistedGoalOperatingPlan, persistGoalOperatingPlan } from '@/lib/goals/persist-plan';
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/google/google-calendar';
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
