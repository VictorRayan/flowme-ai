import {
  loadTopFacts,
  saveFact,
  renderFactsForPrompt,
  FACT_CATEGORIES,
  MAX_ACTIVE_FACTS,
  type SavedFact,
} from '@/lib/ai/memory/facts';

function makeMockSupabase(state: { rows: any[] }) {
  const supabase: any = {
    from: jest.fn(() => supabase),
    select: jest.fn(() => supabase),
    eq: jest.fn(() => supabase),
    in: jest.fn(() => supabase),
    ilike: jest.fn((_col: string, _val: string) => supabase),
    order: jest.fn(() => supabase),
    limit: jest.fn((n: number) => {
      const items = state.rows.filter((r: any) => !r.is_archived).slice(0, n);
      return Promise.resolve({ data: items, error: null });
    }),
    single: jest.fn(() => Promise.resolve({ data: state.rows[state.rows.length - 1], error: null })),
    insert: jest.fn((row: any) => {
      const inserted = { id: `id-${state.rows.length + 1}`, is_archived: false, use_count: 1, ...row };
      state.rows.push(inserted);
      return supabase;
    }),
    update: jest.fn((patch: any) => {
      Object.assign(supabase, { _patch: patch });
      return supabase;
    }),
  };
  return supabase;
}

describe('FACT_CATEGORIES', () => {
  it('exports the 6 expected categories', () => {
    expect(FACT_CATEGORIES).toEqual(['family', 'work', 'health', 'preference', 'context', 'other']);
  });
});

describe('MAX_ACTIVE_FACTS', () => {
  it('caps at 200', () => {
    expect(MAX_ACTIVE_FACTS).toBe(200);
  });
});

describe('renderFactsForPrompt', () => {
  it('returns empty string for empty list', () => {
    expect(renderFactsForPrompt([])).toBe('');
  });

  it('renders facts as bullets with category tags', () => {
    const facts: SavedFact[] = [
      { id: '1', fact: 'Wife is Anna', category: 'family', use_count: 3, last_used_at: '2026-05-01' },
      { id: '2', fact: 'Allergic to penicillin', category: 'health', use_count: 1, last_used_at: '2026-04-20' },
    ];
    const text = renderFactsForPrompt(facts);
    expect(text).toContain('Persistent facts');
    expect(text).toContain('[family] Wife is Anna');
    expect(text).toContain('[health] Allergic to penicillin');
  });

  it('renders facts without category if none provided', () => {
    const facts: SavedFact[] = [
      { id: '1', fact: 'Prefers Portuguese', category: null, use_count: 1, last_used_at: '2026-05-01' },
    ];
    expect(renderFactsForPrompt(facts)).toContain('- Prefers Portuguese');
  });
});

describe('saveFact validation', () => {
  it('rejects facts shorter than 3 chars', async () => {
    const supabase = makeMockSupabase({ rows: [] });
    const r = await saveFact(supabase, 'user-1', { fact: 'ab' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/3 chars/);
  });

  it('rejects facts longer than 280 chars', async () => {
    const supabase = makeMockSupabase({ rows: [] });
    const r = await saveFact(supabase, 'user-1', { fact: 'a'.repeat(281) });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/280 chars/);
  });

  it('rejects unknown categories', async () => {
    const supabase = makeMockSupabase({ rows: [] });
    const r = await saveFact(supabase, 'user-1', { fact: 'A valid fact about user', category: 'bogus' as any });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/category/);
  });

  it('accepts a valid fact', async () => {
    const supabase = makeMockSupabase({ rows: [] });
    const r = await saveFact(supabase, 'user-1', { fact: 'User prefers Portuguese', category: 'preference' });
    expect(r.ok).toBe(true);
    expect(['saved', 'updated']).toContain(r.status);
  });
});

describe('loadTopFacts', () => {
  it('returns [] when supabase errors', async () => {
    const supabase: any = {
      from: jest.fn(() => supabase),
      select: jest.fn(() => supabase),
      eq: jest.fn(() => supabase),
      order: jest.fn(() => supabase),
      limit: jest.fn(() => Promise.resolve({ data: null, error: { message: 'boom' } })),
    };
    const facts = await loadTopFacts(supabase, 'user-1');
    expect(facts).toEqual([]);
  });

  it('returns rows from supabase', async () => {
    const supabase: any = {
      from: jest.fn(() => supabase),
      select: jest.fn(() => supabase),
      eq: jest.fn(() => supabase),
      order: jest.fn(() => supabase),
      limit: jest.fn(() =>
        Promise.resolve({
          data: [{ id: '1', fact: 'X', category: null, use_count: 1, last_used_at: '2026-05-01' }],
          error: null,
        })
      ),
    };
    const facts = await loadTopFacts(supabase, 'user-1');
    expect(facts).toHaveLength(1);
    expect(facts[0].fact).toBe('X');
  });
});
