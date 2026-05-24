import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ALLOWED_CHANNELS = new Set(['web', 'whatsapp', 'push']);

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { data, error } = await supabase
      .from('user_profile')
      .select('morning_briefing_time, evening_briefing_time, briefing_timezone, news_topics, briefing_delivery, daily_routine_enabled, briefing_city')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
    return apiSuccess({ preferences: data || null });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.INTERNAL_ERROR, err?.message || 'Failed', 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const body = await req.json().catch(() => ({}));

    const update: Record<string, unknown> = {};

    if (typeof body.morning_briefing_time === 'string' || body.morning_briefing_time === null) {
      if (body.morning_briefing_time !== null && !TIME_RE.test(body.morning_briefing_time)) {
        return apiError(ErrorCode.VALIDATION_ERROR, 'morning_briefing_time must be HH:MM');
      }
      update.morning_briefing_time = body.morning_briefing_time;
    }
    if (typeof body.evening_briefing_time === 'string' || body.evening_briefing_time === null) {
      if (body.evening_briefing_time !== null && !TIME_RE.test(body.evening_briefing_time)) {
        return apiError(ErrorCode.VALIDATION_ERROR, 'evening_briefing_time must be HH:MM');
      }
      update.evening_briefing_time = body.evening_briefing_time;
    }
    if (typeof body.briefing_timezone === 'string' || body.briefing_timezone === null) {
      update.briefing_timezone = body.briefing_timezone;
    }
    if (Array.isArray(body.news_topics)) {
      const cleaned = body.news_topics
        .map((t: unknown) => (typeof t === 'string' ? t.trim() : ''))
        .filter((t: string) => t.length > 0 && t.length <= 80)
        .slice(0, 3);
      update.news_topics = cleaned;
    }
    if (Array.isArray(body.briefing_delivery)) {
      const cleaned = body.briefing_delivery
        .map((c: unknown) => (typeof c === 'string' ? c.trim().toLowerCase() : ''))
        .filter((c: string) => ALLOWED_CHANNELS.has(c));
      update.briefing_delivery = cleaned.length > 0 ? cleaned : ['web'];
    }
    if (typeof body.daily_routine_enabled === 'boolean') {
      update.daily_routine_enabled = body.daily_routine_enabled;
    }
    if (typeof body.briefing_city === 'string' || body.briefing_city === null) {
      update.briefing_city = body.briefing_city;
    }

    if (Object.keys(update).length === 0) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'no fields to update');
    }

    const { data: existing } = await supabase
      .from('user_profile')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('user_profile')
        .update({ ...update, last_updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
    } else {
      const { error } = await supabase
        .from('user_profile')
        .insert({ user_id: user.id, profile: {}, ...update });
      if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
    }

    return apiSuccess({ updated: true });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('PATCH /api/briefings/preferences error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, err?.message || 'Failed', 500);
  }
}
