import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { listThreads, ensureThread } from '@/lib/ai/threads';

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const url = new URL(req.url);
    const includeArchived = url.searchParams.get('includeArchived') === '1';
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 500);

    const threads = await listThreads(supabase, user.id, { includeArchived, limit });
    return apiSuccess({ threads });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('[threads GET] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const created = await ensureThread(supabase, user.id, {
      id: typeof body.id === 'string' ? body.id : undefined,
      title: typeof body.title === 'string' ? body.title : 'New chat',
      provider: typeof body.provider === 'string' ? body.provider : undefined,
      model: typeof body.model === 'string' ? body.model : undefined,
      tier: typeof body.tier === 'string' ? body.tier : undefined,
      route_label: typeof body.route_label === 'string' ? body.route_label : undefined,
      execution_plan: typeof body.execution_plan === 'string' ? body.execution_plan : undefined,
    });
    if (!created) return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to create thread', 500);
    return apiSuccess({ thread: created });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('[threads POST] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
