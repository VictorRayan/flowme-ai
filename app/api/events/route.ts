import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

const EVENT_FIELDS = 'id, title, description, start_at, end_at, scheduled_date, duration_minutes, source_type, outcome, is_time_blocked';
const VALID_PRIORITY_LABELS = ['non_negotiable', 'negotiable', 'routine'];

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const url = new URL(req.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');

    if (!start || !end) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'start and end query parameters are required');
    }

    const { data: events, error } = await supabase
      .from('microactivities')
      .select(EVENT_FIELDS)
      .eq('user_id', user.id)
      .gte('start_at', start)
      .lt('start_at', end)
      .order('start_at', { ascending: true });

    if (error) throw error;

    return apiSuccess({ events: events || [] });
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('GET /api/events error:', err);
    return apiError(ErrorCode.SUPABASE_ERROR, 'Failed to fetch events', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const body = await req.json();
    const { title, description, start_at, end_at, scheduled_date, duration_minutes, priority_label } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'Title is required');
    }
    if (!start_at && !scheduled_date) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'start_at or scheduled_date is required');
    }
    if (scheduled_date && (typeof scheduled_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(scheduled_date))) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'scheduled_date must be YYYY-MM-DD');
    }
    if (priority_label && !VALID_PRIORITY_LABELS.includes(priority_label)) {
      return apiError(ErrorCode.VALIDATION_ERROR, `priority_label must be one of: ${VALID_PRIORITY_LABELS.join(', ')}`);
    }
    if (end_at && start_at && new Date(end_at) <= new Date(start_at)) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'end_at must be strictly greater than start_at');
    }

    const eventDate = typeof scheduled_date === 'string'
      ? scheduled_date
      : String(start_at).slice(0, 10);
    const startAt = start_at || `${eventDate}T09:00:00.000Z`;
    const duration = typeof duration_minutes === 'number'
      ? duration_minutes
      : inferDurationMinutes(startAt, end_at);

    const { data: event, error } = await supabase
      .from('microactivities')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: typeof description === 'string' ? description.trim() || null : null,
        scheduled_date: eventDate,
        start_at: startAt,
        end_at: end_at || null,
        duration_minutes: duration,
        category: priority_label || 'negotiable',
        source_type: 'manual',
        outcome: 'pending',
        is_time_blocked: Boolean(start_at && end_at),
      })
      .select(EVENT_FIELDS)
      .single();

    if (error) throw error;

    return apiSuccess({ event });
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('POST /api/events error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to create event', 500);
  }
}

function inferDurationMinutes(startAt?: string | null, endAt?: string | null): number | null {
  if (!startAt || !endAt) return null;
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.max(1, Math.ceil((end - start) / 60000));
}
