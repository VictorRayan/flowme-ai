import { ensureThread, persistMessage, listThreads, getThreadMessages, deleteThread, renameThread } from '@/lib/ai/threads';

type MockState = { threads: Array<Record<string, any>>; messages: Array<Record<string, any>> };

function makeMockSupabase(state: MockState = { threads: [], messages: [] }) {
  const chain: any = {
    _table: '',
    _resolveData: () => {
      const arr = chain._table === 'threads' ? state.threads : state.messages;
      return { data: arr, error: null };
    },
    then(resolve: Function, reject: Function) {
      return Promise.resolve(chain._resolveData()).then(resolve as any, reject as any);
    },
    catch(reject: Function) {
      return Promise.resolve(chain._resolveData()).catch(reject as any);
    },
  };
  const passthrough = ['select', 'eq', 'in', 'order', 'not', 'gte', 'lt'];
  for (const m of passthrough) chain[m] = jest.fn().mockReturnValue(chain);

  chain.from = jest.fn((table: string) => { chain._table = table; return chain; });
  chain.limit = jest.fn(() => Promise.resolve(chain._resolveData()));
  chain.maybeSingle = jest.fn(() => {
    const arr = chain._table === 'threads' ? state.threads : state.messages;
    return Promise.resolve({ data: arr[0] || null, error: null });
  });
  chain.single = jest.fn(() => {
    const arr = chain._table === 'threads' ? state.threads : state.messages;
    return Promise.resolve({ data: arr[arr.length - 1] || null, error: null });
  });
  chain.insert = jest.fn((row: any) => {
    const inserted = { id: `id-${Date.now()}-${Math.random()}`, ...row };
    if (chain._table === 'threads') state.threads.push(inserted);
    else state.messages.push(inserted);
    return chain;
  });
  chain.update = jest.fn(() => chain);
  chain.delete = jest.fn(() => chain);
  return chain;
}

describe('ensureThread', () => {
  it('creates a new thread when none exists', async () => {
    const state: MockState = { threads: [], messages: [] };
    const supabase = makeMockSupabase(state);
    const created = await ensureThread(supabase, 'user-1', { title: 'Test' });
    expect(created).toBeTruthy();
    expect(state.threads.length).toBe(1);
    expect(state.threads[0].title).toBe('Test');
  });

  it('uses provided id when given', async () => {
    const state: MockState = { threads: [], messages: [] };
    const supabase = makeMockSupabase(state);
    const created = await ensureThread(supabase, 'user-1', { id: 'abc-123', title: 'X' });
    expect(created).toBeTruthy();
    expect(state.threads[0].id).toBe('abc-123');
  });
});

describe('persistMessage', () => {
  it('strips dataUrl from attachments', async () => {
    const state: MockState = { threads: [], messages: [] };
    const supabase = makeMockSupabase(state);
    await persistMessage(supabase, 'user-1', {
      thread_id: 'thread-1',
      role: 'user',
      content: 'hi',
      attachments: [{ type: 'image', name: 'pic.png', mimeType: 'image/png' } as any],
    });
    expect(state.messages.length).toBe(1);
    const m = state.messages[0];
    expect(m.attachments).toEqual([{ type: 'image', name: 'pic.png', mimeType: 'image/png' }]);
    expect(m.attachments[0].dataUrl).toBeUndefined();
  });

  it('stores empty attachments as null', async () => {
    const state: MockState = { threads: [], messages: [] };
    const supabase = makeMockSupabase(state);
    await persistMessage(supabase, 'user-1', {
      thread_id: 'thread-1',
      role: 'assistant',
      content: 'reply',
    });
    expect(state.messages.length).toBe(1);
    expect(state.messages[0].attachments).toBeNull();
  });

  it('preserves authenticated URLs for generated image attachments', async () => {
    const state: MockState = { threads: [], messages: [] };
    const supabase = makeMockSupabase(state);
    await persistMessage(supabase, 'user-1', {
      thread_id: 'thread-1',
      role: 'assistant',
      content: 'Generated.',
      attachments: [{
        type: 'image',
        name: 'balys-image.png',
        mimeType: 'image/png',
        url: '/api/ai/images?key=users%2Fuser-1%2Fgenerated-images%2Fimage.png',
      }],
    });
    expect(state.messages[0].attachments[0].url).toContain('/api/ai/images?key=');
  });
});

describe('renameThread', () => {
  it('rejects empty title', async () => {
    const supabase = makeMockSupabase();
    const ok = await renameThread(supabase, 'user-1', 'thread-1', '   ');
    expect(ok).toBe(false);
  });

  it('accepts valid title', async () => {
    const supabase = makeMockSupabase();
    const ok = await renameThread(supabase, 'user-1', 'thread-1', 'My new title');
    expect(ok).toBe(true);
  });
});

describe('deleteThread', () => {
  it('returns true on successful delete', async () => {
    const supabase = makeMockSupabase();
    const ok = await deleteThread(supabase, 'user-1', 'thread-1');
    expect(ok).toBe(true);
  });
});

describe('listThreads / getThreadMessages', () => {
  it('returns empty list when none', async () => {
    const supabase = makeMockSupabase();
    const list = await listThreads(supabase, 'user-1');
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(0);
  });

  it('getThreadMessages returns array', async () => {
    const supabase = makeMockSupabase();
    const msgs = await getThreadMessages(supabase, 'user-1', 'thread-1');
    expect(Array.isArray(msgs)).toBe(true);
  });
});
