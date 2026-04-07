import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, user } = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const updates: any = {};
    if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;
    if (body.name && body.name.trim().length >= 2) updates.name = body.name.trim();
    if (body.type === 'work' || body.type === 'personal') updates.type = body.type;

    if (Object.keys(updates).length === 0) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'No valid fields provided for update');
    }

    const { data: account, error } = await supabase
      .from('linked_accounts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id) // Security check included via RLS anyway, but explicitly doing it here for clarity
      .select('id, name, type, is_active, provider')
      .single();

    if (error) {
      if (error.code === '23505') {
        return apiError(ErrorCode.VALIDATION_ERROR, 'You already have an account with this name');
      }
      throw error;
    }

    return apiSuccess({ account });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('PATCH /api/linked-accounts/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, user } = await requireAuth();
    const { id } = await params;

    // Check if it's the primary account
    const { data: account } = await supabase
      .from('linked_accounts')
      .select('name')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (account && account.name === user.email) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'Cannot delete your primary linked account.');
    }

    const { error } = await supabase
      .from('linked_accounts')
      .update({ is_deleted: true, is_active: false })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    return apiSuccess();
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('DELETE /api/linked-accounts/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
