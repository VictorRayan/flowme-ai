import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { composeBriefing } from '@/lib/briefings/composer';
import { getBriefing, upsertBriefing } from '@/lib/briefings/persist';
import { shouldReuseBriefing } from '@/lib/briefings/reuse';
import type { BriefingSlot } from '@/lib/briefings/types';

function todayInTimezone(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const map: Record<string, string> = {};
    for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
    return `${map.year}-${map.month}-${map.day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function slotForHour(hour: number): BriefingSlot {
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function inferSlot(timezone: string): BriefingSlot {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, hour: '2-digit', hour12: false }).formatToParts(new Date());
    const raw = parts.find((p) => p.type === 'hour')?.value || '0';
    const hour = parseInt(raw === '24' ? '0' : raw, 10);
    return slotForHour(hour);
  } catch {
    return slotForHour(new Date().getHours());
  }
}

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const slotParam = searchParams.get('slot');
    const force = searchParams.get('force') === '1';

    const { data: profile } = await supabase
      .from('user_profile')
      .select('briefing_timezone, news_topics, briefing_city, morning_briefing_time, evening_briefing_time')
      .eq('user_id', user.id)
      .maybeSingle();

    const timezone = profile?.briefing_timezone || 'UTC';
    const slot: BriefingSlot = (slotParam === 'morning' || slotParam === 'afternoon' || slotParam === 'evening') ? slotParam : inferSlot(timezone);
    const date = todayInTimezone(timezone);

    if (!force) {
      const existing = await getBriefing(supabase as any, user.id, slot, date);
      if (existing && shouldReuseBriefing(existing.sections)) return apiSuccess({ briefing: existing });
    }

    const sections = await composeBriefing({
      supabase: supabase as any,
      user: { id: user.id } as any,
      timezone,
      nowIso: new Date().toISOString(),
    } as any, {
      slot,
      news_topics: profile?.news_topics || [],
      city: profile?.briefing_city || null,
    });

    const saved = await upsertBriefing(supabase as any, user.id, { slot, briefing_date: date, sections });
    return apiSuccess({
      briefing: saved || {
        id: null,
        user_id: user.id,
        slot,
        briefing_date: date,
        sections,
        generated_at: new Date().toISOString(),
        delivered_at: null,
        channels_delivered: [],
        persisted: false,
      },
    });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('GET /api/briefings error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, err?.message || 'Failed', 500);
  }
}
