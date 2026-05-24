import type { BriefingSections, BriefingSlot } from './types';

type SupabaseLike = { from(table: string): any };

export interface BriefingRow {
  id: string;
  user_id: string;
  slot: BriefingSlot;
  briefing_date: string;
  sections: BriefingSections;
  generated_at: string;
  delivered_at: string | null;
  channels_delivered: string[];
}

export async function upsertBriefing(
  supabase: SupabaseLike,
  userId: string,
  input: { slot: BriefingSlot; briefing_date: string; sections: BriefingSections },
): Promise<BriefingRow | null> {
  const values = {
    user_id: userId,
    slot: input.slot,
    briefing_date: input.briefing_date,
    sections: input.sections,
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('briefings')
    .upsert(values, { onConflict: 'user_id,slot,briefing_date' })
    .select('id, user_id, slot, briefing_date, sections, generated_at, delivered_at, channels_delivered')
    .single();
  if (error) {
    console.error('[briefings.upsert] error:', error);
    return null;
  }
  return data as BriefingRow;
}

export async function getBriefing(
  supabase: SupabaseLike,
  userId: string,
  slot: BriefingSlot,
  date: string,
): Promise<BriefingRow | null> {
  const { data, error } = await supabase
    .from('briefings')
    .select('id, user_id, slot, briefing_date, sections, generated_at, delivered_at, channels_delivered')
    .eq('user_id', userId)
    .eq('slot', slot)
    .eq('briefing_date', date)
    .maybeSingle();
  if (error) {
    console.error('[briefings.get] error:', error);
    return null;
  }
  return data as BriefingRow | null;
}

export async function markDelivered(
  supabase: SupabaseLike,
  briefingId: string,
  channel: string,
): Promise<void> {
  const { data } = await supabase
    .from('briefings')
    .select('channels_delivered')
    .eq('id', briefingId)
    .maybeSingle();
  const channels = new Set<string>([...((data?.channels_delivered as string[]) || []), channel]);
  await supabase
    .from('briefings')
    .update({
      delivered_at: new Date().toISOString(),
      channels_delivered: Array.from(channels),
      updated_at: new Date().toISOString(),
    })
    .eq('id', briefingId);
}
