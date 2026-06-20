import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { getSupabaseAdmin } from '@/lib/api/admin';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { FeatureLockedError, requireFeature } from '@/lib/billing/entitlements';
import { recordGoalCalendarEventLinks } from '@/lib/goals/calendar-event-links';
import { cleanupPersistedGoalOperatingPlan, persistGoalOperatingPlan } from '@/lib/goals/persist-plan';
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/google/google-calendar';

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    await requireFeature(getSupabaseAdmin(), user.id, 'goals');
    const body = await req.json();
    if (!body.linked_account_id) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'linked_account_id is required because action-plan tasks must be Google Calendar events');
    }

    const { data: account, error: accountError } = await supabase
      .from('linked_accounts')
      .select('id, is_active, is_deleted')
      .eq('id', body.linked_account_id)
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) return apiError(ErrorCode.NOT_FOUND, 'Linked account not found');
    if (!account.is_active || account.is_deleted) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'Cannot create events using an inactive or deleted account');
    }

    let result: Awaited<ReturnType<typeof persistGoalOperatingPlan>> | null = null;
    const createdGoogleEventIds: string[] = [];
    try {
      result = await persistGoalOperatingPlan(supabase, user.id, {
        annual_smart_goal: body.annual_smart_goal,
        monthly_milestone: body.monthly_milestone,
        weekly_routine: body.weekly_routine,
        start_date: body.start_date,
        target_date: body.target_date,
        preferred_time: body.preferred_time,
        default_task_duration_minutes: body.default_task_duration_minutes,
        execution_window_days: body.execution_window_days,
      });
      const calendarEvents = [];
      for (const task of result.plan.recurring_events) {
        const startAt = task.start_at;
        const endAt = task.end_at;
        const event = await createCalendarEvent(body.linked_account_id, {
          title: task.title,
          description: task.description,
          startAt,
          endAt,
          recurrence: task.recurrence,
        });
        createdGoogleEventIds.push(event.id);
        calendarEvents.push({
          title: task.title,
          provider_event_id: event.id,
          html_link: event.htmlLink,
          start_at: startAt,
          end_at: endAt,
          task,
        });
      }
      const persisted = result!.persisted;
      await recordGoalCalendarEventLinks(supabase, user.id, calendarEvents.map(event => ({
        linked_account_id: body.linked_account_id,
        provider_event_id: event.provider_event_id,
        action_plan_id: persisted.action_plan.id,
        goal_id: persisted.goals.weekly.id,
        title: event.title,
        scheduled_date: event.task.scheduled_date,
        start_at: event.start_at,
        end_at: event.end_at,
        duration_minutes: event.task.duration_minutes,
        recurrence: event.task.recurrence ?? null,
        plan_day: null,
        sort_order: 0,
      })));
      return apiSuccess({
        ...result,
        calendar_events: calendarEvents.map(({ task, ...event }) => event),
      });
    } catch (err) {
      if (err instanceof Error && isPlanValidationMessage(err.message)) {
        return apiError(ErrorCode.VALIDATION_ERROR, err.message);
      }
      await rollbackCalendarEvents(body.linked_account_id, createdGoogleEventIds);
      if (result) {
        await cleanupPersistedGoalOperatingPlan(supabase, user.id, result.persisted);
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof FeatureLockedError) {
      return apiError(ErrorCode.FEATURE_LOCKED, 'Goals require Flow Me Pro', 402, {
        required_plan: err.required_plan,
        feature_key: err.feature,
        checkout_available: true,
      });
    }
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    console.error('POST /api/goals/plan error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to create goal operating plan', 500);
  }
}

async function rollbackCalendarEvents(linkedAccountId: string, eventIds: string[]) {
  for (const eventId of eventIds) {
    try {
      await deleteCalendarEvent(linkedAccountId, eventId);
    } catch (error) {
      console.error('POST /api/goals/plan calendar rollback failed:', { eventId, error });
    }
  }
}

function isPlanValidationMessage(message: string): boolean {
  return [
    'annual_smart_goal is required',
    'monthly_milestone is required',
    'weekly_routine is required',
  ].includes(message);
}
