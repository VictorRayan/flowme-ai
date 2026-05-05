import {
  SUMMARIZE_EVERY_N_USER_TURNS,
  RECALL_DEFAULT_K,
  RECALL_SIMILARITY_THRESHOLD,
  recallSimilarThreads,
} from '@/lib/ai/memory/recall';

describe('recall constants', () => {
  it('rolling cadence is 8', () => {
    expect(SUMMARIZE_EVERY_N_USER_TURNS).toBe(8);
  });

  it('default k is 4', () => {
    expect(RECALL_DEFAULT_K).toBe(4);
  });

  it('similarity threshold is 0.55', () => {
    expect(RECALL_SIMILARITY_THRESHOLD).toBeCloseTo(0.55, 2);
  });
});

describe('recallSimilarThreads', () => {
  const ORIGINAL_FETCH = global.fetch;
  const ORIGINAL_KEY = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    process.env.OPENAI_API_KEY = ORIGINAL_KEY;
  });

  it('returns [] when OPENAI_API_KEY missing', async () => {
    delete process.env.OPENAI_API_KEY;
    const supabase: any = { from: jest.fn(() => supabase) };
    const matches = await recallSimilarThreads(supabase, 'user-1', 'find me something');
    expect(matches).toEqual([]);
  });

  it('returns [] when no rows in supabase', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ embedding: new Array(1536).fill(0.1) }] }),
    })) as any;

    const supabase: any = {
      from: jest.fn(() => supabase),
      select: jest.fn(() => supabase),
      eq: jest.fn(() => supabase),
      not: jest.fn(() => supabase),
      order: jest.fn(() => supabase),
      limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
    };

    const matches = await recallSimilarThreads(supabase, 'user-1', 'anything');
    expect(matches).toEqual([]);
  });

  it('filters by similarity threshold and excludes current thread', async () => {
    const queryEmbedding = new Array(1536).fill(0.1);
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ embedding: queryEmbedding }] }),
    })) as any;

    const supabase: any = {
      from: jest.fn(() => supabase),
      select: jest.fn(() => supabase),
      eq: jest.fn(() => supabase),
      not: jest.fn(() => supabase),
      order: jest.fn(() => supabase),
      limit: jest.fn(() =>
        Promise.resolve({
          data: [
            { thread_id: 'current-thread', summary: 'A', key_topics: [], embedding: queryEmbedding, summarized_at: '2026-05-01' },
            { thread_id: 'old-thread', summary: 'B', key_topics: ['career'], embedding: queryEmbedding, summarized_at: '2026-04-01' },
            { thread_id: 'irrelevant-thread', summary: 'C', key_topics: [], embedding: new Array(1536).fill(-0.1), summarized_at: '2026-03-01' },
          ],
          error: null,
        }),
      ),
    };

    const matches = await recallSimilarThreads(supabase, 'user-1', 'salary career', { excludeThreadId: 'current-thread' });

    expect(matches.find((m) => m.thread_id === 'current-thread')).toBeUndefined();
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const oldMatch = matches.find((m) => m.thread_id === 'old-thread');
    expect(oldMatch).toBeDefined();
    expect(oldMatch!.similarity).toBeGreaterThanOrEqual(RECALL_SIMILARITY_THRESHOLD);
  });

  it('returns at most k matches sorted by similarity desc', async () => {
    const queryVec = new Array(1536).fill(0.1);
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ embedding: queryVec }] }),
    })) as any;

    const rows = Array.from({ length: 8 }, (_, i) => ({
      thread_id: `t${i}`,
      summary: `s${i}`,
      key_topics: [],
      embedding: queryVec.map((v) => v + i * 0.0001),
      summarized_at: `2026-05-${String(i + 1).padStart(2, '0')}`,
    }));

    const supabase: any = {
      from: jest.fn(() => supabase),
      select: jest.fn(() => supabase),
      eq: jest.fn(() => supabase),
      not: jest.fn(() => supabase),
      order: jest.fn(() => supabase),
      limit: jest.fn(() => Promise.resolve({ data: rows, error: null })),
    };

    const matches = await recallSimilarThreads(supabase, 'user-1', 'anything', { k: 3 });
    expect(matches.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].similarity).toBeGreaterThanOrEqual(matches[i].similarity);
    }
  });
});
