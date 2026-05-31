import { sendText } from '@/lib/whatsapp/evolution-client';
import { summarizeTitle } from '@/lib/goals/planner';
import type { BriefingSections, BriefingSlot } from './types';
import { sendWebPush } from '@/lib/web-push/send';

type SupabaseLike = { from(table: string): any };

function greeting(slot: BriefingSlot): string {
  if (slot === 'morning') return 'Bom dia';
  if (slot === 'afternoon') return 'Boa tarde';
  return 'Boa noite';
}

function appTodayUrl(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.flow-me.online'}/app/today`;
}

export function summarizeForWhatsapp(slot: BriefingSlot, sections: BriefingSections): string {
  const lines: string[] = [`*${greeting(slot)}!* Aqui está seu resumo.`];
  lines.push(`👉 Abrir no app: ${appTodayUrl()}`);

  if (sections.weather.ok && sections.weather.data) {
    const w = sections.weather.data;
    lines.push(`\n🌤️ ${w.condition || 'Clima'}, ${Math.round(w.temperature_c)}°C em ${w.city}`);
    if (w.advice) lines.push(`• ${w.advice}`);
  }

  if (sections.calendar.ok && sections.calendar.data && sections.calendar.data.events.length > 0) {
    lines.push(`\n📅 *Sua agenda*`);
    for (const event of sections.calendar.data.events.slice(0, 3)) {
      const hm = new Date(event.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      lines.push(`• ${hm} — ${summarizeTitle(event.title)}`);
    }
  }

  if (sections.goal.ok && sections.goal.data) {
    lines.push(`\n🎯 *Meta de hoje*\n${sections.goal.data.title}`);
  }

  if (sections.news.ok && sections.news.data) {
    const allItems = sections.news.data.by_topic.flatMap((t) => t.items).slice(0, 3);
    if (allItems.length > 0) {
      lines.push(`\n📰 *Pra ficar por dentro*`);
      for (const item of allItems) lines.push(`• ${item.title}`);
    }
  }

  if (sections.trends.ok && sections.trends.data && sections.trends.data.trends.length > 0) {
    lines.push(`\n💬 *No ar agora*`);
    for (const trend of sections.trends.data.trends.slice(0, 3)) {
      const title = trend.headline || trend.topic;
      const detail = trend.subheadline || trend.summary;
      lines.push(`• ${title} — ${detail}${trend.url ? `\n  ${trend.url}` : ''}`);
    }
  }

  return lines.join('\n');
}

export async function deliverWhatsapp(
  supabase: SupabaseLike,
  userId: string,
  slot: BriefingSlot,
  sections: BriefingSections,
): Promise<{ ok: boolean; error?: string }> {
  const { data: channel } = await supabase
    .from('whatsapp_channels')
    .select('phone, status, reminders_enabled')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (!channel?.phone) return { ok: false, error: 'no active whatsapp channel' };
  try {
    await sendText(channel.phone, summarizeForWhatsapp(slot, sections));
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'whatsapp send failed' };
  }
}

export async function deliverWebPush(
  supabase: SupabaseLike,
  userId: string,
  slot: BriefingSlot,
): Promise<{ ok: boolean; error?: string }> {
  return sendWebPush(supabase, userId, {
    title: greeting(slot) + ', seu resumo está pronto',
    body: 'Toque para abrir o resumo no Flowme.',
    url: '/app/today',
  });
}
