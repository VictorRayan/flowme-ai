import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { getCalendarEvents } from '@/lib/google/google-calendar';
import { buildDayUnit, normalizeCalendarEventTask } from '@/lib/goals/task-dto';

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

    const tasks = [];

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
