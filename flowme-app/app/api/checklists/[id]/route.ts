import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';

const CHECKLIST_FIELDS = 'id,name,status,created_by,created_at,updated_at,completed_at';
const VALID_STATUS = ['active', 'completed', 'archived'] as const;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const name = text(body.name);
    if (name) {
      if (name.length > 120) return apiError(ErrorCode.VALIDATION_ERROR, 'Checklist name is too long', 400);
      patch.name = name;
    }
    if (typeof body.status === 'string') {
      if (!VALID_STATUS.includes(body.status as typeof VALID_STATUS[number])) return apiError(ErrorCode.VALIDATION_ERROR, 'Invalid checklist status', 400);
      patch.status = body.status;
      patch.completed_at = body.status === 'completed' ? new Date().toISOString() : null;
    }
    if (Object.keys(patch).length === 1) return apiError(ErrorCode.VALIDATION_ERROR, 'No checklist updates provided', 400);

    const { data, error } = await supabase
      .from('checklists')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .select(CHECKLIST_FIELDS)
      .single();
    if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
    return apiSuccess({ checklist: data });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to update checklist', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { id } = await params;
    const { error } = await supabase.from('checklists').delete().eq('id', id).eq('user_id', user.id);
    if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
    return apiSuccess({ deleted: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to delete checklist', 500);
  }
}
