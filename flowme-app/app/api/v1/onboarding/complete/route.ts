import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { cleanupPersistedGoalOperatingPlan, persistGoalOperatingPlan } from '@/lib/goals/persist-plan';
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/google/google-calendar';

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const body = await req.json();
    const { morningTime, eveningTime, goalProposals } = body;

    if (!morningTime || !eveningTime) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'Missing morningTime or eveningTime');
    }

    // Upsert user settings
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        morning_rhythm_time: morningTime,
        evening_rhythm_time: eveningTime,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('[Onboarding Complete API] Upsert Error:', error);
      return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
    }

    const proposals = Array.isArray(goalProposals) ? goalProposals : [];
    let linkedAccountId: string | null = null;
    if (proposals.length > 0) {
      const { data: accounts, error: accountsError } = await supabase
        .from('linked_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (accountsError) return apiError(ErrorCode.SUPABASE_ERROR, accountsError.message, 500);
      linkedAccountId = Array.isArray(accounts) && accounts[0]?.id ? accounts[0].id : null;
      if (!linkedAccountId) {
        return apiError(ErrorCode.VALIDATION_ERROR, 'Connect Google Calendar before creating goal plan tasks');
      }
    }
    const calendarAccountId = linkedAccountId;

    const createdPlans = [];
    for (const proposal of proposals) {
      let result: Awaited<ReturnType<typeof persistGoalOperatingPlan>> | null = null;
      const createdGoogleEventIds: string[] = [];
      try {
        result = await persistGoalOperatingPlan(supabase, user.id, {
          annual_smart_goal: proposal.annual_smart_goal,
          monthly_milestone: proposal.monthly_milestone,
          weekly_routine: proposal.weekly_routine,
          start_date: new Date().toISOString().slice(0, 10),
          execution_window_days: 7,
        });

        for (const task of result.plan.active_tasks) {
          if (!calendarAccountId) {
            return apiError(ErrorCode.VALIDATION_ERROR, 'Connect Google Calendar before creating goal plan tasks');
          }
          const startAt = task.start_at || `${task.scheduled_date}T09:00:00.000Z`;
          const endAt = task.end_at || addMinutesIso(startAt, task.duration_minutes || 30);
          const event = await createCalendarEvent(calendarAccountId, {
            title: task.title,
            description: task.description,
            startAt,
            endAt,
          });
          createdGoogleEventIds.push(event.id);
        }

        createdPlans.push(result);
      } catch (error) {
        if (calendarAccountId) await rollbackCalendarEvents(calendarAccountId, createdGoogleEventIds);
        if (result) await cleanupPersistedGoalOperatingPlan(supabase, user.id, result.persisted);
        throw error;
      }
    }

    return apiSuccess({ success: true, created_plan_count: createdPlans.length });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('[Onboarding Complete API] Internal Error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
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
      console.error('[Onboarding Complete API] Calendar rollback failed:', { eventId, error });
    }
  }
}
