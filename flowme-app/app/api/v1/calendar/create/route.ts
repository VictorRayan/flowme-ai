import { NextRequest } from 'next/server';
import { requireApiKeyAuth } from '@/lib/api/api-key-auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { createCalendarEvent } from '@/lib/google/google-calendar';
import { getUserEntitlements, isFeatureAllowed } from '@/lib/billing/entitlements';

/**
 * POST /api/v1/calendar/create
 * Create a new calendar event via Google Calendar.
 *
 * Body (JSON):
 *   - linked_account_id (required): UUID of the linked Google account
 *   - title (required): Event title
 *   - start_at (required): ISO datetime
 *   - end_at (required): ISO datetime
 *   - description: Event description
 *   - create_meet: Boolean - create a Google Meet link
 *   - participants: Array of { email: string }
 *
 * Auth: Bearer <api_key> with scope "calendar.write"
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiKeyAuth(req, ['calendar.write']);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;
    const entitlements = await getUserEntitlements(supabase, userId);
    if (!isFeatureAllowed(entitlements, 'calendar')) {
      return apiError(ErrorCode.FEATURE_LOCKED, 'Calendar requires Flow Me Pro', 402, {
        required_plan: 'pro', feature_key: 'calendar', checkout_available: true,
      });
    }

    const body = await req.json();
    const { linked_account_id, title, description, start_at, end_at, create_meet, participants } = body;

    if (!linked_account_id) return apiError(ErrorCode.VALIDATION_ERROR, 'linked_account_id is required');
    if (!title || typeof title !== 'string' || title.trim().length === 0) return apiError(ErrorCode.VALIDATION_ERROR, 'title is required');
    if (!start_at || !end_at) return apiError(ErrorCode.VALIDATION_ERROR, 'start_at and end_at are required');

    // Validate account ownership
    const { data: account, error: accountError } = await supabase
      .from('linked_accounts')
      .select('id, is_active, is_deleted')
      .eq('id', linked_account_id)
      .eq('user_id', userId)
      .single();

    if (accountError || !account) {
      return apiError(ErrorCode.NOT_FOUND, 'Linked account not found');
    }
    if (!account.is_active || account.is_deleted) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'Cannot create event using an inactive or deleted account');
    }

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
      meet_link: result.meetLink,
    });
  } catch (err: any) {
    console.error('POST /api/v1/calendar/create error:', err);
    if (err.message === ErrorCode.GOOGLE_AUTH_MISSING) {
      return apiError(ErrorCode.GOOGLE_AUTH_MISSING, 'Google OAuth token is missing. Reconnect the account.', 401);
    }
    if (err.message === ErrorCode.GOOGLE_TOKEN_REFRESH_FAILED) {
      return apiError(ErrorCode.GOOGLE_TOKEN_REFRESH_FAILED, 'Failed to refresh Google token. Reconnect the account.', 401);
    }
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
