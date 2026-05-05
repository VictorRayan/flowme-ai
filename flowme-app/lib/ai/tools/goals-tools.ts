import { z } from 'zod';
import { defineTool } from './Tool';
import { persistGoalOperatingPlan } from '@/lib/goals/persist-plan';

const goalTimeframeSchema = z.enum(['yearly', 'monthly', 'weekly']);
const goalStatusSchema = z.enum(['not_started', 'in_progress', 'completed', 'cancelled']);
const planStatusSchema = z.enum(['not_started', 'in_progress', 'completed', 'cancelled']);
const priorityLabelSchema = z.enum(['non_negotiable', 'negotiable', 'routine']);

const GOAL_FIELDS = `
  id, title, description, timeframe, parent_goal_id, status, target_date,
  objective_metric, target_value, current_value, unit, starts_on, due_on, success_criteria,
  created_at, updated_at
`;

const ACTION_PLAN_FIELDS = `
  id, title, description, linked_goal_id, linked_goal_ids, plan_type, problem_statement,
  status, duration_days, starts_on, review_date, success_criteria, priority_label,
  created_at, updated_at
`;

const TASK_FIELDS = `
  id, title, scheduled_date, start_at, end_at, duration_minutes, category, priority,
  linked_goal_id, action_plan_id, plan_day, source_type, outcome
`;

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
  description: `Create a long-term Goal Operating System: persistent yearly/monthly/weekly goal records + a short action plan sprint + calendar events for the first execution window.

CONCEPTS — understand before calling:
- GOAL: a long-term objective (yearly/monthly/weekly). Lives in the Goals page. Never expires until the user achieves or cancels it.
- ACTION PLAN: a short execution sprint (max 21 days) that works toward a goal. When its review_date arrives it should be renewed. It is NOT the goal itself.
- TASKS / CALENDAR EVENTS: concrete occurrences scheduled on specific dates inside the action plan window, placed on the user's calendar.

WHEN TO USE:
- The user explicitly accepts a goal proposal.
- The user asks to turn a yearly goal into monthly/weekly/day execution.

CONTRACT — cadence rules (CRITICAL — apply exactly):
- "finais de semana" / "weekends" → Saturday (6) and Sunday (0) ONLY. Never weekdays.
- "dias úteis" / "weekdays" → Monday–Friday (1–5) ONLY. Never weekends.
- Named days ("segunda", "monday", etc.) → only those exact days.
- No cadence mentioned → infer daily but WARN and ask user to confirm before calling.
- execution_window_days defaults to 14. Max is 21. For weekend-only goals ~14 days yields ~4 occurrences — correct.
- NEVER schedule tasks on days that don't match the cadence.

CALENDAR EVENTS:
- Always call calendar.create_event for each task occurrence so the user sees them in Google Calendar.
- Do this AFTER this tool returns, in the same agent loop, using the scheduled_dates from the receipt.
- If no preferred_time was given, remind the user to pick times and offer to schedule them.

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
    };
  }, z.object({
    annual_smart_goal:           z.string().min(8).max(1000).describe('The full yearly SMART goal as a plain string. Example: "Reach R$10.000 monthly revenue by December 2026". REQUIRED. Pass directly — do NOT nest inside another object.'),
    monthly_milestone:           z.string().min(4).max(1000).describe('The first monthly milestone as a plain string. REQUIRED. Pass directly.'),
    weekly_routine:              z.string().min(4).max(1000).describe('The recurring weekly execution routine as a plain string, including cadence words (e.g. "finais de semana", "weekdays"). REQUIRED. Pass directly.'),
    start_date:                  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('ISO date YYYY-MM-DD when the plan starts. Defaults to today.'),
    target_date:                 z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('ISO date YYYY-MM-DD for the yearly goal deadline. Defaults to Dec 31 of this year.'),
    preferred_time:              z.string().regex(/^\d{2}:\d{2}$/).optional().describe('Preferred start time for tasks in HH:MM (24h). Optional — if omitted, tasks are flexible.'),
    default_task_duration_minutes: z.number().min(1).max(240).optional().describe('Duration in minutes for each task occurrence. Defaults to 15.'),
    execution_window_days:       z.number().min(1).max(21).optional().describe('How many calendar days to materialise tasks for. Defaults to 14. Max 21.'),
  })),
  call: async (args, context) => {
    try {
      const result = await persistGoalOperatingPlan(context.supabase, context.user.id, args);
      const tasks = result.persisted.tasks as Array<{ scheduled_date: string; start_at?: string | null; end_at?: string | null; title: string }>;
      return {
        ok: true,
        receipt: {
          goals_created: 3,
          action_plan_created: true,
          tasks_created: tasks.length,
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
          warnings: result.plan.warnings,
          next_step: tasks.length > 0 && args.preferred_time
            ? 'Use calendar.create_event to add each scheduled_date occurrence to Google Calendar.'
            : 'Ask the user what time they prefer for these sessions, then use calendar.create_event for each date.',
          summary: `Goal created. ${tasks.length} task(s) scheduled for the first ${result.plan.future_work_template.concrete_window_days} days (${result.plan.future_work_template.cadence_summary}). Action plan renews on ${result.plan.action_plan.review_date}.`,
        },
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Failed to create goal operating plan' };
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
- After creating, call calendar.create_event for each task so they appear on the user's calendar.

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
    priority_label: priorityLabelSchema.optional().default('negotiable'),
    tasks: z.array(z.object({
      title: z.string().min(3).max(180),
      description: z.string().max(800).optional(),
      scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      start_at: z.string().datetime().optional(),
      end_at: z.string().datetime().optional(),
      duration_minutes: z.number().min(1).max(240).optional().default(5),
      priority_label: priorityLabelSchema.optional().default('negotiable'),
    })).max(366).optional().default([]),
  })),
  call: async (args, context) => {
    const linkedGoalIds = Array.from(new Set(args.linked_goal_ids || []));
    const startsOn = args.starts_on || context.nowIso.slice(0, 10);
    const durationDays = args.duration_days ?? 14;
    const priorityLabel = args.priority_label ?? 'negotiable';
    const taskInputs = args.tasks || [];
    const reviewDate = args.review_date || addDays(startsOn, durationDays);
    const created: { actionPlanId: string | null; taskIds: string[] } = { actionPlanId: null, taskIds: [] };

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
          priority_label: priorityLabel,
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

      let tasks: Array<{ id: string; title: string }> = [];
      if (taskInputs.length > 0) {
        const taskRows = taskInputs.map((task, index) => {
          const scheduledDate = task.scheduled_date || addDays(startsOn, index);
          const duration = task.duration_minutes || inferDurationMinutes(task.start_at, task.end_at) || 5;
          return {
            user_id: context.user.id,
            title: task.title.trim(),
            description: task.description?.trim() || null,
            category: task.priority_label,
            status: 'pending',
            priority: priorityScore(task.priority_label),
            scheduled_date: scheduledDate,
            start_at: task.start_at || `${scheduledDate}T09:00:00.000Z`,
            end_at: task.end_at || null,
            duration_minutes: duration,
            linked_goal_id: linkedGoalIds[0] || null,
            action_plan_id: actionPlan.id,
            plan_day: index + 1,
            is_recurring: false,
            recurrence_rule: null,
            source_type: 'action_plan_task',
            source_id: `short-plan-${index + 1}`,
            outcome: 'pending',
            priority_source: 'balys',
            priority_reason: `Task created for short-term action plan: ${args.title.trim()}`,
            is_time_blocked: Boolean(task.start_at && task.end_at),
            sort_order: index,
          };
        });

        const { data, error } = await context.supabase
          .from('microactivities')
          .insert(taskRows)
          .select(TASK_FIELDS);
        if (error) throw error;
        tasks = data || [];
        created.taskIds = tasks.map(task => task.id);
      }

      const flexibleEventCount = taskInputs.filter(task => !task.start_at).length;
      return {
        ok: true,
        receipt: {
          action_plan: actionPlan,
          tasks_created: tasks.length,
          linked_goal_count: linkedGoalIds.length,
          warnings: flexibleEventCount > 0
            ? [`${flexibleEventCount} event(s) are flexible because no start time was provided.`]
            : [],
          summary: `Created a short-term action plan with ${tasks.length} Flowme event(s).`,
        },
      };
    } catch (error) {
      await cleanupShortActionPlan(context.supabase, context.user.id, created);
      return { ok: false, error: error instanceof Error ? error.message : 'Failed to create short-term action plan' };
    }
  },
});

async function cleanupShortActionPlan(
  supabase: any,
  userId: string,
  created: { actionPlanId: string | null; taskIds: string[] },
) {
  try {
    if (created.taskIds.length > 0) {
      await supabase.from('microactivities').delete().eq('user_id', userId).in('id', created.taskIds);
    }
    if (created.actionPlanId) {
      await supabase.from('action_plan_goal_links').delete().eq('user_id', userId).eq('action_plan_id', created.actionPlanId);
      await supabase.from('action_plans').delete().eq('user_id', userId).eq('id', created.actionPlanId);
    }
  } catch (error) {
    console.error('Short action plan cleanup failed:', error);
  }
}

function priorityScore(label: 'non_negotiable' | 'negotiable' | 'routine'): number {
  if (label === 'non_negotiable') return 3;
  if (label === 'routine') return 1;
  return 2;
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
