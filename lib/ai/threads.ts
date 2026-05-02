/**
 * Server-side persistence layer for Balys threads and messages.
 *
 * Threads have always lived in browser localStorage. We now ALSO persist them
 * server-side so:
 * - cross-device sync works,
 * - the cron summarizer has access to full transcripts,
 * - Tier B recall can search beyond rolling summaries.
 *
 * Design: localStorage stays as a fast cache and offline fallback. Server is
 * the source of truth.
 */

export interface ThreadAttachmentMeta {
  type: 'image' | 'file' | 'audio';
  name: string;
  mimeType: string;
}

export interface PersistedThreadRow {
  id: string;
  user_id: string;
  title: string;
  provider: string | null;
  model: string | null;
  tier: string | null;
  route_label: string | null;
  execution_plan: string | null;
  is_archived: boolean;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export interface PersistedMessageRow {
  id: string;
  thread_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments: ThreadAttachmentMeta[] | null;
  transcript: string | null;
  thinking: unknown | null;
  created_at: string;
}

export interface ThreadMetaInput {
  id?: string;
  title?: string;
  provider?: string;
  model?: string;
  tier?: string;
  route_label?: string;
  execution_plan?: string;
}

export interface PersistMessageInput {
  thread_id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: ThreadAttachmentMeta[];
  transcript?: string;
  thinking?: unknown;
}

/**
 * Ensures a thread row exists for the given (user_id, thread_id).
 * Idempotent: if it already exists, returns it; otherwise inserts.
 * If thread_id is not provided, a new UUID is generated server-side.
 */
export async function ensureThread(
  supabase: any,
  userId: string,
  meta: ThreadMetaInput,
): Promise<PersistedThreadRow | null> {
  try {
    if (meta.id) {
      const { data: existing } = await supabase
        .from('threads')
        .select('*')
        .eq('id', meta.id)
        .eq('user_id', userId)
        .maybeSingle();
      if (existing) {
        // Lightly refresh routing fields if they were provided.
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (meta.title && meta.title !== existing.title) patch.title = meta.title;
        if (meta.provider) patch.provider = meta.provider;
        if (meta.model) patch.model = meta.model;
        if (meta.tier) patch.tier = meta.tier;
        if (meta.route_label) patch.route_label = meta.route_label;
        if (meta.execution_plan) patch.execution_plan = meta.execution_plan;
        if (Object.keys(patch).length > 1) {
          await supabase.from('threads').update(patch).eq('id', meta.id).eq('user_id', userId);
        }
        return existing as PersistedThreadRow;
      }
    }

    const insert: Record<string, unknown> = {
      user_id: userId,
      title: meta.title || 'New chat',
      provider: meta.provider || null,
      model: meta.model || null,
      tier: meta.tier || null,
      route_label: meta.route_label || null,
      execution_plan: meta.execution_plan || null,
    };
    if (meta.id) insert.id = meta.id;

    const { data, error } = await supabase
      .from('threads')
      .insert(insert)
      .select('*')
      .single();
    if (error) {
      console.error('[threads.ensureThread] insert error:', error);
      return null;
    }
    return data as PersistedThreadRow;
  } catch (e) {
    console.error('[threads.ensureThread] threw:', e);
    return null;
  }
}

/**
 * Persists a single message. Best-effort: logs and returns null on error.
 * Strips attachment dataUrls (those stay in localStorage for the browser).
 */
export async function persistMessage(
  supabase: any,
  userId: string,
  input: PersistMessageInput,
): Promise<PersistedMessageRow | null> {
  try {
    const attachmentsMeta: ThreadAttachmentMeta[] | null = input.attachments
      ? input.attachments
          .filter((a): a is ThreadAttachmentMeta => Boolean(a && a.type && a.name))
          .map((a) => ({ type: a.type, name: a.name, mimeType: a.mimeType }))
      : null;

    const { data, error } = await supabase
      .from('thread_messages')
      .insert({
        thread_id: input.thread_id,
        user_id: userId,
        role: input.role,
        content: input.content || '',
        attachments: attachmentsMeta && attachmentsMeta.length > 0 ? attachmentsMeta : null,
        transcript: input.transcript || null,
        thinking: input.thinking || null,
      })
      .select('*')
      .single();
    if (error) {
      console.error('[threads.persistMessage] insert error:', error);
      return null;
    }
    return data as PersistedMessageRow;
  } catch (e) {
    console.error('[threads.persistMessage] threw:', e);
    return null;
  }
}

export async function listThreads(
  supabase: any,
  userId: string,
  options?: { includeArchived?: boolean; limit?: number },
): Promise<PersistedThreadRow[]> {
  try {
    let q = supabase
      .from('threads')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false })
      .limit(options?.limit ?? 100);
    if (!options?.includeArchived) q = q.eq('is_archived', false);
    const { data, error } = await q;
    if (error) {
      console.error('[threads.listThreads] error:', error);
      return [];
    }
    return (data || []) as PersistedThreadRow[];
  } catch (e) {
    console.error('[threads.listThreads] threw:', e);
    return [];
  }
}

export async function getThreadMessages(
  supabase: any,
  userId: string,
  threadId: string,
): Promise<PersistedMessageRow[]> {
  try {
    const { data, error } = await supabase
      .from('thread_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[threads.getThreadMessages] error:', error);
      return [];
    }
    return (data || []) as PersistedMessageRow[];
  } catch (e) {
    console.error('[threads.getThreadMessages] threw:', e);
    return [];
  }
}

export async function deleteThread(
  supabase: any,
  userId: string,
  threadId: string,
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('threads')
      .delete()
      .eq('user_id', userId)
      .eq('id', threadId);
    if (error) {
      console.error('[threads.deleteThread] error:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[threads.deleteThread] threw:', e);
    return false;
  }
}

export async function renameThread(
  supabase: any,
  userId: string,
  threadId: string,
  title: string,
): Promise<boolean> {
  const trimmed = (title || '').trim().slice(0, 200);
  if (!trimmed) return false;
  try {
    const { error } = await supabase
      .from('threads')
      .update({ title: trimmed, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('id', threadId);
    if (error) {
      console.error('[threads.renameThread] error:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[threads.renameThread] threw:', e);
    return false;
  }
}
