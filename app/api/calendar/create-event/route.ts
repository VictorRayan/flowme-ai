import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { createCalendarEvent } from '@/lib/google/google-calendar';

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth();
    const body = await req.json();

    const {
      linked_account_id,
      title,
      description,
      start_at,
      end_at,
      create_meet,
      participants
    } = body;

    // Validation
    if (!linked_account_id) return apiError(ErrorCode.VALIDATION_ERROR, 'linked_account_id is required');
    if (!title || typeof title !== 'string' || title.trim().length === 0) return apiError(ErrorCode.VALIDATION_ERROR, 'title is required');
    if (!start_at || !end_at) return apiError(ErrorCode.VALIDATION_ERROR, 'start_at and end_at are required');
    
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
        return apiError(ErrorCode.VALIDATION_ERROR, 'Cannot create event using an inactive or deleted account');
    }

    // Call Google API wrapper
    const result = await createCalendarEvent(linked_account_id, {
        title: title.trim(),
        description: description?.trim(),
        startAt: start_at,
        endAt: end_at,
        createMeet: !!create_meet,
        participants: Array.isArray(participants) ? participants : undefined,
    });

    return apiSuccess({
        provider_event_id: result.id,
        html_link: result.htmlLink,
        meet_link: result.meetLink
    });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    
    console.error('POST /api/calendar/create-event error:', err);
    if (err.message === ErrorCode.GOOGLE_AUTH_MISSING) {
        return apiError(ErrorCode.GOOGLE_AUTH_MISSING, 'Google OAuth token is missing. Please reconnect the account.', 401);
    }
    if (err.message === ErrorCode.GOOGLE_TOKEN_REFRESH_FAILED) {
        return apiError(ErrorCode.GOOGLE_TOKEN_REFRESH_FAILED, 'Failed to refresh Google token. Please reconnect the account.', 401);
    }
    
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
