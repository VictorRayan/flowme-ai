import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { deleteCalendarEvent } from '@/lib/google/google-calendar';

export async function DELETE(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const body = await req.json();

    const { event_id, linked_account_id } = body;

    if (!event_id) return apiError(ErrorCode.VALIDATION_ERROR, 'event_id is required');
    if (!linked_account_id) return apiError(ErrorCode.VALIDATION_ERROR, 'linked_account_id is required');

    const { data: account, error: accountError } = await supabase
      .from('linked_accounts')
      .select('id, is_active, is_deleted')
      .eq('id', linked_account_id)
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      return apiError(ErrorCode.NOT_FOUND, 'Linked account not found');
    }

    if (!account.is_active || account.is_deleted) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'Cannot use an inactive or deleted account');
    }

    await deleteCalendarEvent(linked_account_id, event_id);

    return apiSuccess({ provider_event_id: event_id });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);

    console.error('DELETE /api/calendar/delete-event error:', err);
    if (err.message === ErrorCode.GOOGLE_AUTH_MISSING) {
      return apiError(ErrorCode.GOOGLE_AUTH_MISSING, 'Google OAuth token is missing. Please reconnect the account.', 401);
    }
    if (err.message === ErrorCode.GOOGLE_TOKEN_REFRESH_FAILED) {
      return apiError(ErrorCode.GOOGLE_TOKEN_REFRESH_FAILED, 'Failed to refresh Google token. Please reconnect the account.', 401);
    }

    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
