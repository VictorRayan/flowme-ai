import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { ensureThread, persistMessage, type ThreadAttachmentMeta } from '@/lib/ai/threads';

/**
 * One-shot client-side migration endpoint.
 *
 * The Balys chat used to store threads in browser localStorage. This endpoint
 * accepts a batch of those threads and persists them server-side.
 *
 * Idempotent: if a thread with the same id already exists for this user, it
 * is left alone (we don't merge messages — first persistence wins).
 */
export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const threads = Array.isArray(body?.threads) ? body.threads : [];

    if (threads.length === 0) {
      return apiSuccess({ migrated: 0, skipped: 0 });
    }
    if (threads.length > 200) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'too many threads in one batch (max 200)');
    }

    let migrated = 0;
    let skipped = 0;

    for (const t of threads) {
      if (!t || typeof t.id !== 'string' || !Array.isArray(t.messages) || t.messages.length === 0) {
        skipped++;
        continue;
      }

      // Skip threads that look truly empty (only one user message with no reply)
      const hasReply = t.messages.some((m: any) => m.role === 'assistant' && m.content && String(m.content).trim());
      if (!hasReply) {
        skipped++;
        continue;
      }

      // Check if already persisted
      const { data: existing } = await supabase
        .from('threads')
        .select('id')
        .eq('id', t.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (existing) {
        skipped++;
        continue;
      }

      const created = await ensureThread(supabase, user.id, {
        id: t.id,
        title: typeof t.title === 'string' ? t.title : 'New chat',
        provider: typeof t.provider === 'string' ? t.provider : undefined,
        model: typeof t.model === 'string' ? t.model : undefined,
        tier: typeof t.tier === 'string' ? t.tier : undefined,
        route_label: typeof t.routeLabel === 'string' ? t.routeLabel : undefined,
        execution_plan: typeof t.executionPlan === 'string' ? t.executionPlan : undefined,
      });
      if (!created) {
        skipped++;
        continue;
      }

      for (const m of t.messages) {
        if (!m || typeof m.role !== 'string') continue;
        if (m.role !== 'user' && m.role !== 'assistant') continue;
        const content = typeof m.content === 'string' ? m.content : '';
        const attachments: ThreadAttachmentMeta[] | undefined = Array.isArray(m.attachments)
          ? m.attachments
              .filter((a: any) => a && typeof a.type === 'string' && typeof a.name === 'string')
              .map((a: any) => ({ type: a.type, name: a.name, mimeType: a.mimeType || '' }))
          : undefined;
        await persistMessage(supabase, user.id, {
          thread_id: created.id,
          role: m.role,
          content,
          attachments,
          selected_action: m.selectedAction,
          transcript: typeof m.transcript === 'string' ? m.transcript : undefined,
          thinking: m.thinking,
        });
      }

      migrated++;
    }

    return apiSuccess({ migrated, skipped, total: threads.length });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('[threads/backfill] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
