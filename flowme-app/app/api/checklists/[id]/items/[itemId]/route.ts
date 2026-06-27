import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';

const ITEM_FIELDS = 'id,checklist_id,title,checked,sort_order,created_at,updated_at,checked_at';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { id, itemId } = await params;
    const body = await req.json().catch(() => ({}));
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const title = text(body.title);
    if (title) {
      if (title.length > 200) return apiError(ErrorCode.VALIDATION_ERROR, 'Checklist item title is too long', 400);
      patch.title = title;
    }
    if (typeof body.checked === 'boolean') {
      patch.checked = body.checked;
      patch.checked_at = body.checked ? new Date().toISOString() : null;
    }
    if (typeof body.sort_order === 'number') patch.sort_order = body.sort_order;
    if (Object.keys(patch).length === 1) return apiError(ErrorCode.VALIDATION_ERROR, 'No checklist item updates provided', 400);

    const { data, error } = await supabase
      .from('checklist_items')
      .update(patch)
      .eq('id', itemId)
      .eq('checklist_id', id)
      .eq('user_id', user.id)
      .select(ITEM_FIELDS)
      .single();
    if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
    return apiSuccess({ item: data });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to update checklist item', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { id, itemId } = await params;
    const { error } = await supabase
      .from('checklist_items')
      .delete()
      .eq('id', itemId)
      .eq('checklist_id', id)
      .eq('user_id', user.id);
    if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
    return apiSuccess({ deleted: true });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to delete checklist item', 500);
  }
}
