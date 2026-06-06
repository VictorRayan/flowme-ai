export type BalysEntryThread = {
  id: string;
  title: string;
  messages?: unknown[];
};

function isReusableFreshThread(thread: BalysEntryThread): boolean {
  return thread.title.trim().toLowerCase() === 'new chat'
    && (!Array.isArray(thread.messages) || thread.messages.length === 0);
}

export function ensureFreshEntryThread<T extends BalysEntryThread>(
  threads: T[],
  createThread: () => T,
): { threads: T[]; activeThreadId: string } {
  const reusable = threads.find(isReusableFreshThread);
  if (reusable) {
    return {
      threads: [reusable, ...threads.filter((thread) => thread.id !== reusable.id)],
      activeThreadId: reusable.id,
    };
  }

  const fresh = createThread();
  return {
    threads: [fresh, ...threads],
    activeThreadId: fresh.id,
  };
}
