import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { getCalendarEvents } from '@/lib/google/google-calendar';
import { buildDayUnit, normalizeCalendarEventTask, normalizeFlowmeEventTask } from '@/lib/goals/task-dto';

const TASK_FIELDS = `
  id, title, description, notes, category, status, priority,
  scheduled_date, start_at, end_at, completed_at, duration_minutes,
  linked_goal_id, action_plan_id, plan_day,
  is_recurring, recurrence_rule, source_type, source_id, outcome, outcome_reason,
  moved_to_task_id, priority_source, priority_reason, is_time_blocked, sort_order,
  created_at, updated_at
`;

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const timezone = searchParams.get('timezone') || 'UTC';
    const includeGoogleEvents = searchParams.get('includeGoogleEvents') !== 'false';

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'date must be YYYY-MM-DD');
    }
    if (!isValidTimezone(timezone)) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'timezone is invalid');
    }

    const { data: flowmeEvents, error } = await supabase
      .from('microactivities')
      .select(TASK_FIELDS)
      .eq('user_id', user.id)
      .eq('scheduled_date', date)
      .order('sort_order', { ascending: true })
      .order('priority', { ascending: false })
      .order('start_at', { ascending: true });

    if (error) throw error;

    // Fetch action plan names for any plans referenced today
    const planIds = [...new Set(
      (flowmeEvents || []).map(r => r.action_plan_id).filter(Boolean)
    )];
    let planTitleMap: Record<string, string> = {};
    if (planIds.length > 0) {
      const { data: plans } = await supabase
        .from('action_plans')
        .select('id, title')
        .eq('user_id', user.id)
        .in('id', planIds);
      if (plans) {
        planTitleMap = Object.fromEntries(plans.map(p => [p.id, p.title]));
      }
    }

    const tasks = (flowmeEvents || []).map(row => ({
      ...normalizeFlowmeEventTask(row),
      action_plan_title: row.action_plan_id ? (planTitleMap[row.action_plan_id] ?? null) : null,
    }));

    if (includeGoogleEvents) {
      const { start, end } = getLocalDayBounds(date, timezone);
      const { data: accounts, error: accountsError } = await supabase
        .from('linked_accounts')
        .select('id, name, type, provider')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .eq('provider', 'google');

      if (accountsError) throw accountsError;

      for (const account of accounts || []) {
        try {
          const events = await getCalendarEvents(account.id, start.toISOString(), end.toISOString());
          for (const event of events) {
            const startAt = event.start?.dateTime || event.start?.date || null;
            if (!startAt) continue;
            tasks.push(normalizeCalendarEventTask({
              id: event.id || `${account.id}:${startAt}`,
              provider_event_id: event.id || null,
              linked_account_id: account.id,
              title: event.summary || 'Untitled Event',
              description: event.description || null,
              start_at: startAt,
              end_at: event.end?.dateTime || event.end?.date || null,
            }, date));
          }
        } catch (calendarError) {
          console.error(`GET /api/tasks/day calendar fetch failed for account ${account.id}:`, calendarError);
        }
      }
    }

    return apiSuccess({ day: buildDayUnit(date, timezone, tasks) });
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    console.error('GET /api/tasks/day error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to fetch day tasks', 500);
  }
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function getLocalDayBounds(date: string, timezone: string): { start: Date; end: Date } {
  const [year, month, day] = date.split('-').map(Number);
  const start = zonedTimeToUtc(year, month, day, timezone);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const end = zonedTimeToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), timezone);
  return { start, end };
}

function zonedTimeToUtc(year: number, month: number, day: number, timezone: string): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const firstOffset = getTimezoneOffsetMs(utcGuess, timezone);
  const corrected = new Date(utcGuess.getTime() - firstOffset);
  const secondOffset = getTimezoneOffsetMs(corrected, timezone);
  return new Date(utcGuess.getTime() - secondOffset);
}

function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return asUtc - date.getTime();
}
