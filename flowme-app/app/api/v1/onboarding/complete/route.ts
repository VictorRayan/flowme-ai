import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { cleanupPersistedGoalOperatingPlan, persistGoalOperatingPlan } from '@/lib/goals/persist-plan';
import { createCalendarEvent } from '@/lib/google/google-calendar';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isRateLimit = (err: any) => err?.code === 403 || err?.status === 403 || /rate limit/i.test(String(err?.message || ''));

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
    let calendarEventsCreated = 0;
    let calendarEventsSkipped = 0;
    let calendarEventsFailed = 0;
    let calendarRateLimited = false;
    const persistedRoutines = new Set<string>();
    const bookedSlots: Array<{ startMin: number; endMin: number }> = [];

    const slotConflicts = (startMin: number, endMin: number) =>
      bookedSlots.some((slot) => startMin < slot.endMin && endMin > slot.startMin);

    for (const proposal of proposals) {
      const routineKey = String(proposal.weekly_routine || '').trim().toLowerCase();
      if (persistedRoutines.has(routineKey)) continue;
      persistedRoutines.add(routineKey);

      let result: Awaited<ReturnType<typeof persistGoalOperatingPlan>> | null = null;
      let preferredTime: string | undefined;
      let durationMinutes: number | undefined;
      try {
        preferredTime = typeof proposal.preferred_time === 'string' && /^\d{1,2}:\d{2}$/.test(proposal.preferred_time)
          ? proposal.preferred_time.padStart(5, '0')
          : undefined;
        durationMinutes = Number.isFinite(Number(proposal.default_task_duration_minutes))
          ? Math.max(5, Math.min(240, Math.round(Number(proposal.default_task_duration_minutes))))
          : undefined;

        if (preferredTime && durationMinutes) {
          const [hh, mm] = preferredTime.split(':').map(Number);
          const startMin = hh * 60 + mm;
          const endMin = startMin + durationMinutes;
          if (slotConflicts(startMin, endMin)) {
            preferredTime = undefined;
            durationMinutes = undefined;
            calendarEventsSkipped += 1;
            console.warn('[Onboarding Complete API] Skipping calendar events for conflicting slot:', proposal.annual_smart_goal);
          } else {
            bookedSlots.push({ startMin, endMin });
          }
        }

        result = await persistGoalOperatingPlan(supabase, user.id, {
          annual_smart_goal: proposal.annual_smart_goal,
          monthly_milestone: proposal.monthly_milestone,
          weekly_routine: proposal.weekly_routine,
          preferred_time: preferredTime,
          default_task_duration_minutes: durationMinutes,
          start_date: new Date().toISOString().slice(0, 10),
          execution_window_days: 7,
        });
        createdPlans.push(result);
      } catch (error) {
        if (result) await cleanupPersistedGoalOperatingPlan(supabase, user.id, result.persisted);
        throw error;
      }

      if (!calendarAccountId || calendarRateLimited) continue;

      for (const task of result.plan.active_tasks) {
        if (!task.start_at || !task.end_at) {
          calendarEventsSkipped += 1;
          continue;
        }
        try {
          await createCalendarEvent(calendarAccountId, {
            title: task.title,
            description: task.description,
            startAt: task.start_at,
            endAt: task.end_at,
          });
          calendarEventsCreated += 1;
          await sleep(250);
        } catch (evErr: any) {
          calendarEventsFailed += 1;
          if (isRateLimit(evErr)) {
            calendarRateLimited = true;
            console.warn('[Onboarding Complete API] Google Calendar rate limit hit; skipping remaining events.');
            break;
          }
          console.warn('[Onboarding Complete API] Calendar event failed (continuing):', evErr?.message || evErr);
        }
      }
    }

    return apiSuccess({
      success: true,
      created_plan_count: createdPlans.length,
      calendar_events_created: calendarEventsCreated,
      calendar_events_skipped: calendarEventsSkipped,
      calendar_events_failed: calendarEventsFailed,
      calendar_rate_limited: calendarRateLimited,
    });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('[Onboarding Complete API] Internal Error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}

