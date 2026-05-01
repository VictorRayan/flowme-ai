import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { updateCalendarEvent } from '@/lib/google/google-calendar';

export async function PATCH(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const body = await req.json();

    const {
      event_id,
      linked_account_id,
      title,
      description,
      start_at,
      end_at,
      create_meet,
      participants,
      location,
      reminders
    } = body;

    // Validation
    if (!event_id) return apiError(ErrorCode.VALIDATION_ERROR, 'event_id is required');
    if (!linked_account_id) return apiError(ErrorCode.VALIDATION_ERROR, 'linked_account_id is required');
    if (title && (typeof title !== 'string' || title.trim().length === 0)) return apiError(ErrorCode.VALIDATION_ERROR, 'title must be a valid string');
    
    // Validate account ownership and active status
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

    // Call Google API wrapper to patch the event
    const result = await updateCalendarEvent(linked_account_id, event_id, {
        title: title ? title.trim() : undefined,
        description: description !== undefined ? description.trim() : undefined,
        startAt: start_at,
        endAt: end_at,
        createMeet: create_meet,
        participants: Array.isArray(participants) ? participants : undefined,
        location: location !== undefined ? location.trim() : undefined,
        reminders: reminders,
    });

    return apiSuccess({
        provider_event_id: result.id,
        html_link: result.htmlLink,
        meet_link: result.meetLink
    });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    
    console.error('PATCH /api/calendar/edit-event error:', err);
    if (err.message === ErrorCode.GOOGLE_AUTH_MISSING) {
        return apiError(ErrorCode.GOOGLE_AUTH_MISSING, 'Google OAuth token is missing. Please reconnect the account.', 401);
    }
    if (err.message === ErrorCode.GOOGLE_TOKEN_REFRESH_FAILED) {
        return apiError(ErrorCode.GOOGLE_TOKEN_REFRESH_FAILED, 'Failed to refresh Google token. Please reconnect the account.', 401);
    }
    if (err.message === ErrorCode.GOOGLE_API_ERROR) {
        return apiError(ErrorCode.GOOGLE_API_ERROR, 'Google Calendar rejected this update. Refresh the calendar and try again.', 502);
    }
    
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
