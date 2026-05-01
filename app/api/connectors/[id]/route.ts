import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase, user } = await requireAuth();
    const body = await req.json();
    const { name, is_active, config } = body;

    const updates: Record<string, any> = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return apiError(ErrorCode.VALIDATION_ERROR, 'Name must be at least 2 characters');
      }
      updates.name = name.trim();
    }
    if (is_active !== undefined) updates.is_active = Boolean(is_active);
    if (config !== undefined) updates.config = config;

    if (Object.keys(updates).length === 0) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'No fields to update');
    }

    const { data, error } = await supabase
      .from('connectors')
      .update(updates)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select('id, name, type, is_active, config, created_at')
      .single();

    if (error) throw error;
    if (!data) return apiError(ErrorCode.NOT_FOUND, 'Connector not found', 404);

    return apiSuccess({ connector: data });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('PATCH /api/connectors/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to update connector', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { supabase, user } = await requireAuth();

    const { error } = await supabase
      .from('connectors')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (error) throw error;

    return apiSuccess({ deleted: true });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('DELETE /api/connectors/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to delete connector', 500);
  }
}
