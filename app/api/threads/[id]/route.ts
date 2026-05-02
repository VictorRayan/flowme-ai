import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { getThreadMessages, deleteThread, renameThread } from '@/lib/ai/threads';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { id } = await params;
    const messages = await getThreadMessages(supabase, user.id, id);
    return apiSuccess({ messages });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('[threads/:id GET] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { id } = await params;
    const ok = await deleteThread(supabase, user.id, id);
    if (!ok) return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to delete thread', 500);
    return apiSuccess({ ok: true });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('[threads/:id DELETE] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    if (typeof body.title !== 'string' || !body.title.trim()) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'title is required and must be a non-empty string');
    }
    const ok = await renameThread(supabase, user.id, id, body.title);
    if (!ok) return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to rename thread', 500);
    return apiSuccess({ ok: true });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('[threads/:id PATCH] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
