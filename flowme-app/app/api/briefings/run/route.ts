import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { composeBriefing } from '@/lib/briefings/composer';
import { upsertBriefing, markDelivered } from '@/lib/briefings/persist';
import { deliverWhatsapp, deliverWebPush } from '@/lib/briefings/deliver';
import { findDueSlots } from '@/lib/briefings/scheduler';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase admin credentials missing' }, { status: 500 });
  }

  const admin = createClient(url, serviceRoleKey);
  const due = await findDueSlots(admin as any);

  let generated = 0;
  let delivered = 0;
  let failed = 0;

  for (const slot of due) {
    try {
      const sections = await composeBriefing({
        supabase: admin as any,
        user: { id: slot.user.user_id } as any,
        timezone: slot.user.briefing_timezone || 'UTC',
        nowIso: new Date().toISOString(),
      } as any, {
        slot: slot.slot,
        news_topics: slot.user.news_topics,
        city: slot.user.briefing_city,
      });

      const saved = await upsertBriefing(admin as any, slot.user.user_id, {
        slot: slot.slot,
        briefing_date: slot.briefing_date,
        sections,
      });
      if (!saved) { failed += 1; continue; }
      generated += 1;

      if (slot.user.briefing_delivery.includes('whatsapp')) {
        const r = await deliverWhatsapp(admin as any, slot.user.user_id, slot.slot, sections);
        if (r.ok) { await markDelivered(admin as any, saved.id, 'whatsapp'); delivered += 1; }
      }
      if (slot.user.briefing_delivery.includes('push')) {
        const r = await deliverWebPush(admin as any, slot.user.user_id, slot.slot);
        if (r.ok) { await markDelivered(admin as any, saved.id, 'push'); delivered += 1; }
      }
    } catch (err) {
      console.error('[briefings.run] error for user', slot.user.user_id, err);
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, inspected: due.length, generated, delivered, failed });
}
