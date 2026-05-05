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
    const from     = searchParams.get('from');
    const to       = searchParams.get('to');
    const timezone = searchParams.get('timezone') || 'UTC';

    if (!from || !to) return apiError(ErrorCode.VALIDATION_ERROR, 'from and to required (YYYY-MM-DD)');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
      return apiError(ErrorCode.VALIDATION_ERROR, 'from and to must be YYYY-MM-DD');

    // Enumerate dates in range
    const dates: string[] = [];
    let cur = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T00:00:00.000Z`);
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    if (dates.length > 60) return apiError(ErrorCode.VALIDATION_ERROR, 'range too large (max 60 days)');

    // Fetch all flowme tasks in range
    const { data: rows, error } = await supabase
      .from('microactivities')
      .select(TASK_FIELDS)
      .eq('user_id', user.id)
      .gte('scheduled_date', from)
      .lte('scheduled_date', to)
      .order('scheduled_date', { ascending: true })
      .order('sort_order',     { ascending: true })
      .order('priority',       { ascending: false })
      .order('start_at',       { ascending: true });

    if (error) throw error;

    // Fetch action plan names
    const planIds = [...new Set((rows || []).map((r: any) => r.action_plan_id).filter(Boolean))];
    let planTitleMap: Record<string, string> = {};
    if (planIds.length > 0) {
      const { data: plans } = await supabase
        .from('action_plans').select('id, title')
        .eq('user_id', user.id).in('id', planIds);
      if (plans) planTitleMap = Object.fromEntries(plans.map((p: any) => [p.id, p.title]));
    }

    // Group by date
    const byDate: Record<string, any[]> = {};
    for (const date of dates) byDate[date] = [];
    for (const row of rows || []) {
      const d = row.scheduled_date;
      if (byDate[d]) byDate[d].push({
        ...normalizeFlowmeEventTask(row),
        action_plan_title: row.action_plan_id ? (planTitleMap[row.action_plan_id] ?? null) : null,
      });
    }

    // Fetch Google Calendar events for the whole range
    const { data: accounts } = await supabase
      .from('linked_accounts').select('id, name, type, provider')
      .eq('user_id', user.id).eq('is_active', true).eq('is_deleted', false).eq('provider', 'google');

    if (accounts && accounts.length > 0) {
      const startIso = new Date(`${from}T00:00:00.000Z`).toISOString();
      const endIso   = new Date(`${to}T23:59:59.000Z`).toISOString();
      await Promise.all(accounts.map(async (account: any) => {
        try {
          const events = await getCalendarEvents(account.id, startIso, endIso);
          for (const e of events) {
            const startAt = e.start?.dateTime || e.start?.date || null;
            if (!startAt) continue;
            const date = startAt.slice(0, 10);
            if (!byDate[date]) continue;
            byDate[date].push({
              ...normalizeCalendarEventTask({
                id: e.id || `${account.id}:${startAt}`,
                provider_event_id: e.id || null,
                linked_account_id: account.id,
                title: e.summary || 'Untitled Event',
                description: e.description || null,
                start_at: startAt,
                end_at: e.end?.dateTime || e.end?.date || null,
              }, date),
              action_plan_title: null,
            });
          }
        } catch { /* skip failed account */ }
      }));
    }

    const days = dates.map(date => buildDayUnit(date, timezone, byDate[date] || []));

    return apiSuccess({ days });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('GET /api/tasks/range error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to fetch range', 500);
  }
}
