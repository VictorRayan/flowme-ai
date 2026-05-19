import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { cleanupPersistedGoalOperatingPlan, persistGoalOperatingPlan } from '@/lib/goals/persist-plan';
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/google/google-calendar';

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
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
      for (const task of result.plan.active_tasks) {
        const startAt = task.start_at || `${task.scheduled_date}T09:00:00.000Z`;
        const endAt = task.end_at || addMinutesIso(startAt, task.duration_minutes || 30);
        const event = await createCalendarEvent(body.linked_account_id, {
          title: task.title,
          description: task.description,
          startAt,
          endAt,
        });
        createdGoogleEventIds.push(event.id);
        calendarEvents.push({
          title: task.title,
          provider_event_id: event.id,
          html_link: event.htmlLink,
          start_at: startAt,
          end_at: endAt,
        });
      }
      return apiSuccess({ ...result, calendar_events: calendarEvents });
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
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    console.error('POST /api/goals/plan error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to create goal operating plan', 500);
  }
}

function addMinutesIso(startIso: string, minutes: number): string {
  return new Date(new Date(startIso).getTime() + minutes * 60000).toISOString();
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
