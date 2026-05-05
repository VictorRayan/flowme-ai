export const MAX_ACTIVE_FACTS = 200;
export const FACTS_LOADED_INTO_PROMPT = 15;

export const FACT_CATEGORIES = ['family', 'work', 'health', 'preference', 'context', 'other'] as const;
export type FactCategory = typeof FACT_CATEGORIES[number];

export interface SavedFact {
  id: string;
  fact: string;
  category: FactCategory | null;
  use_count: number;
  last_used_at: string;
}

/**
 * Load the top-N most recently used active facts for a user.
 * Returns ordered by last_used_at desc, then use_count desc.
 */
export async function loadTopFacts(supabase: any, userId: string, limit = FACTS_LOADED_INTO_PROMPT): Promise<SavedFact[]> {
  try {
    const { data, error } = await supabase
      .from('memory_facts')
      .select('id, fact, category, use_count, last_used_at')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('last_used_at', { ascending: false })
      .order('use_count', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('[memory.facts] loadTopFacts error:', error);
      return [];
    }
    return (data || []) as SavedFact[];
  } catch (e) {
    console.error('[memory.facts] loadTopFacts threw:', e);
    return [];
  }
}

export interface SaveFactInput {
  fact: string;
  category?: FactCategory;
  source_thread_id?: string;
}

export interface SaveFactResult {
  ok: boolean;
  fact_id?: string;
  status?: 'saved' | 'updated' | 'duplicate';
  error?: string;
}

/**
 * Save a fact about the user. Idempotent on (user_id, lower(fact)).
 * If duplicate, bumps last_used_at + use_count and returns status='updated'.
 * Auto-prunes when active count exceeds MAX_ACTIVE_FACTS.
 */
export async function saveFact(supabase: any, userId: string, input: SaveFactInput): Promise<SaveFactResult> {
  const fact = (input.fact || '').trim();
  if (fact.length < 3) return { ok: false, error: 'fact must be at least 3 chars' };
  if (fact.length > 280) return { ok: false, error: 'fact must be at most 280 chars' };
  if (input.category && !FACT_CATEGORIES.includes(input.category)) {
    return { ok: false, error: `category must be one of: ${FACT_CATEGORIES.join(', ')}` };
  }

  try {
    // Check for an existing active fact with the same lowercase content.
    const { data: existing } = await supabase
      .from('memory_facts')
      .select('id, use_count')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .ilike('fact', fact)
      .limit(1);

    if (Array.isArray(existing) && existing.length > 0) {
      const row = existing[0];
      const { error: bumpErr } = await supabase
        .from('memory_facts')
        .update({
          last_used_at: new Date().toISOString(),
          use_count: (row.use_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .eq('user_id', userId);
      if (bumpErr) {
        console.error('[memory.facts] bump error:', bumpErr);
        return { ok: false, error: bumpErr.message };
      }
      return { ok: true, fact_id: row.id, status: 'updated' };
    }

    // Insert new active fact.
    const { data: inserted, error: insertErr } = await supabase
      .from('memory_facts')
      .insert({
        user_id: userId,
        fact,
        category: input.category || null,
        source_thread_id: input.source_thread_id || null,
        last_used_at: new Date().toISOString(),
        use_count: 1,
      })
      .select('id')
      .single();
    if (insertErr) {
      console.error('[memory.facts] insert error:', insertErr);
      return { ok: false, error: insertErr.message };
    }

    // Best-effort prune: archive lowest-utility active rows if over cap.
    void pruneIfOverCap(supabase, userId);

    return { ok: true, fact_id: inserted?.id, status: 'saved' };
  } catch (e: any) {
    console.error('[memory.facts] saveFact threw:', e);
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Bumps the last_used_at + use_count for facts that were surfaced in a prompt.
 * Best-effort. Used so the LRU pruner doesn't archive facts the assistant actually relied on.
 */
export async function touchFacts(supabase: any, userId: string, ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  try {
    // Fetch current use_counts (pgresql doesn't allow column-arithmetic in supabase update easily)
    const { data: rows } = await supabase
      .from('memory_facts')
      .select('id, use_count')
      .eq('user_id', userId)
      .in('id', ids);
    if (!Array.isArray(rows) || rows.length === 0) return;
    const now = new Date().toISOString();
    await Promise.all(
      rows.map((r: any) =>
        supabase
          .from('memory_facts')
          .update({ last_used_at: now, use_count: (r.use_count || 0) + 1, updated_at: now })
          .eq('id', r.id)
          .eq('user_id', userId)
      )
    );
  } catch (e) {
    console.error('[memory.facts] touchFacts threw:', e);
  }
}

async function pruneIfOverCap(supabase: any, userId: string): Promise<void> {
  try {
    const { count } = await supabase
      .from('memory_facts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_archived', false);
    const active = count || 0;
    if (active <= MAX_ACTIVE_FACTS) return;

    const excess = active - MAX_ACTIVE_FACTS;
    const { data: candidates } = await supabase
      .from('memory_facts')
      .select('id')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('use_count', { ascending: true })
      .order('last_used_at', { ascending: true })
      .limit(excess);
    if (!Array.isArray(candidates) || candidates.length === 0) return;
    const ids = candidates.map((c: any) => c.id);
    await supabase
      .from('memory_facts')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .in('id', ids);
    console.log(`[memory.facts] Pruned ${ids.length} fact(s) for user ${userId}`);
  } catch (e) {
    console.error('[memory.facts] pruneIfOverCap threw:', e);
  }
}

/**
 * Render top-N facts as a system-prompt block.
 * Returns empty string when there are no facts (don't pollute the prompt).
 */
export function renderFactsForPrompt(facts: SavedFact[]): string {
  if (facts.length === 0) return '';
  const lines: string[] = [
    '## Persistent facts about the user (memory)',
    '',
    'These facts were saved across earlier conversations. Use them naturally — never read them aloud as a list.',
    '',
  ];
  for (const f of facts) {
    const tag = f.category ? `[${f.category}] ` : '';
    lines.push(`- ${tag}${f.fact}`);
  }
  return lines.join('\n');
}
