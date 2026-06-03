import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ALLOWED_CHANNELS = new Set(['web', 'whatsapp', 'push']);
const ALLOWED_RITUAL_CHANNELS = new Set(['whatsapp', 'push']);

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { data, error } = await supabase
      .from('user_profile')
      .select('morning_briefing_time, afternoon_briefing_time, evening_briefing_time, briefing_timezone, news_topics, briefing_delivery, daily_routine_enabled, briefing_city, daily_briefing_note_prompt_enabled, daily_briefing_note_time, daily_briefing_note_channels, weekly_review_enabled, weekly_review_weekday, weekly_review_time, weekly_review_channels, monthly_review_enabled, monthly_review_time, monthly_review_channels, post_event_checkin_enabled, post_event_checkin_channels, mirror_calendar_reminders_to_whatsapp, notification_language, voice_profiles_enabled')
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
    if (typeof body.afternoon_briefing_time === 'string' || body.afternoon_briefing_time === null) {
      if (body.afternoon_briefing_time !== null && !TIME_RE.test(body.afternoon_briefing_time)) {
        return apiError(ErrorCode.VALIDATION_ERROR, 'afternoon_briefing_time must be HH:MM');
      }
      update.afternoon_briefing_time = body.afternoon_briefing_time;
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
    if (typeof body.daily_briefing_note_prompt_enabled === 'boolean') {
      update.daily_briefing_note_prompt_enabled = body.daily_briefing_note_prompt_enabled;
    }
    if (typeof body.daily_briefing_note_time === 'string' || body.daily_briefing_note_time === null) {
      if (body.daily_briefing_note_time !== null && !TIME_RE.test(body.daily_briefing_note_time)) {
        return apiError(ErrorCode.VALIDATION_ERROR, 'daily_briefing_note_time must be HH:MM');
      }
      update.daily_briefing_note_time = body.daily_briefing_note_time;
    }
    if (Array.isArray(body.daily_briefing_note_channels)) {
      update.daily_briefing_note_channels = body.daily_briefing_note_channels
        .filter((channel: unknown): channel is string => typeof channel === 'string' && ALLOWED_RITUAL_CHANNELS.has(channel));
    }
    if (typeof body.weekly_review_enabled === 'boolean') {
      update.weekly_review_enabled = body.weekly_review_enabled;
    }
    if (typeof body.weekly_review_weekday === 'number') {
      if (!Number.isInteger(body.weekly_review_weekday) || body.weekly_review_weekday < 0 || body.weekly_review_weekday > 6) {
        return apiError(ErrorCode.VALIDATION_ERROR, 'weekly_review_weekday must be between 0 and 6');
      }
      update.weekly_review_weekday = body.weekly_review_weekday;
    }
    if (typeof body.weekly_review_time === 'string' || body.weekly_review_time === null) {
      if (body.weekly_review_time !== null && !TIME_RE.test(body.weekly_review_time)) {
        return apiError(ErrorCode.VALIDATION_ERROR, 'weekly_review_time must be HH:MM');
      }
      update.weekly_review_time = body.weekly_review_time;
    }
    if (Array.isArray(body.weekly_review_channels)) {
      update.weekly_review_channels = body.weekly_review_channels
        .filter((channel: unknown): channel is string => typeof channel === 'string' && ALLOWED_RITUAL_CHANNELS.has(channel));
    }
    if (typeof body.monthly_review_enabled === 'boolean') {
      update.monthly_review_enabled = body.monthly_review_enabled;
    }
    if (typeof body.monthly_review_time === 'string' || body.monthly_review_time === null) {
      if (body.monthly_review_time !== null && !TIME_RE.test(body.monthly_review_time)) {
        return apiError(ErrorCode.VALIDATION_ERROR, 'monthly_review_time must be HH:MM');
      }
      update.monthly_review_time = body.monthly_review_time;
    }
    if (Array.isArray(body.monthly_review_channels)) {
      update.monthly_review_channels = body.monthly_review_channels
        .filter((channel: unknown): channel is string => typeof channel === 'string' && ALLOWED_RITUAL_CHANNELS.has(channel));
    }
    if (typeof body.post_event_checkin_enabled === 'boolean') {
      update.post_event_checkin_enabled = body.post_event_checkin_enabled;
    }
    if (Array.isArray(body.post_event_checkin_channels)) {
      update.post_event_checkin_channels = body.post_event_checkin_channels
        .filter((channel: unknown): channel is string => typeof channel === 'string' && ALLOWED_RITUAL_CHANNELS.has(channel));
    }
    if (typeof body.mirror_calendar_reminders_to_whatsapp === 'boolean') {
      update.mirror_calendar_reminders_to_whatsapp = body.mirror_calendar_reminders_to_whatsapp;
    }
    if (body.notification_language === 'pt' || body.notification_language === 'en') {
      update.notification_language = body.notification_language;
    }
    if (typeof body.voice_profiles_enabled === 'boolean') {
      update.voice_profiles_enabled = body.voice_profiles_enabled;
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
