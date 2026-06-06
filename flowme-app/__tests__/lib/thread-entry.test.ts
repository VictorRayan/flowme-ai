import { ensureFreshEntryThread } from '@/lib/ai/thread-entry';

describe('ensureFreshEntryThread', () => {
  it('creates a new empty thread when the latest thread has messages', () => {
    const existing = [
      { id: 'old-1', title: 'Budget', messages: [{ role: 'user', content: 'hi' }] },
    ];

    const result = ensureFreshEntryThread(existing, () => ({ id: 'fresh-1', title: 'New chat', messages: [] }));

    expect(result.activeThreadId).toBe('fresh-1');
    expect(result.threads.map((thread) => thread.id)).toEqual(['fresh-1', 'old-1']);
  });

  it('reuses and moves an existing empty New chat to the top', () => {
    const existing = [
      { id: 'old-1', title: 'Budget', messages: [{ role: 'user', content: 'hi' }] },
      { id: 'fresh-1', title: 'New chat', messages: [] },
      { id: 'old-2', title: 'Plan', messages: [{ role: 'assistant', content: 'ok' }] },
    ];

    const result = ensureFreshEntryThread(existing, () => ({ id: 'fresh-2', title: 'New chat', messages: [] }));

    expect(result.activeThreadId).toBe('fresh-1');
    expect(result.threads.map((thread) => thread.id)).toEqual(['fresh-1', 'old-1', 'old-2']);
  });
});
