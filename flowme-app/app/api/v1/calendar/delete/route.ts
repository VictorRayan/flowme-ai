import { NextRequest } from 'next/server';
import { requireApiKeyAuth } from '@/lib/api/api-key-auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { markGoalCalendarEventDeleted } from '@/lib/goals/calendar-event-links';
import { deleteCalendarEvent } from '@/lib/google/google-calendar';
import { getUserEntitlements, isFeatureAllowed } from '@/lib/billing/entitlements';

/**
 * DELETE /api/v1/calendar/delete
 * Delete a calendar event via Google Calendar.
 *
 * Body (JSON):
 *   - event_id (required): Google Calendar event ID
 *   - linked_account_id (required): UUID of the linked Google account
 *
 * Auth: Bearer <api_key> with scope "calendar.write"
 */
export async function DELETE(req: NextRequest) {
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
    const { event_id, linked_account_id } = body;

    if (!event_id) return apiError(ErrorCode.VALIDATION_ERROR, 'event_id is required');
    if (!linked_account_id) return apiError(ErrorCode.VALIDATION_ERROR, 'linked_account_id is required');

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
      return apiError(ErrorCode.VALIDATION_ERROR, 'Cannot use an inactive or deleted account');
    }

    await deleteCalendarEvent(linked_account_id, event_id);

    let goalEventImpact = null;
    try {
      goalEventImpact = await markGoalCalendarEventDeleted(supabase, userId, {
        linkedAccountId: linked_account_id,
        providerEventId: event_id,
        deletionSource: 'api',
        deletionNote: 'Deleted from external Calendar API',
      });
    } catch (trackingError) {
      console.error('DELETE /api/v1/calendar/delete goal-event tracking failed:', trackingError);
    }

    return apiSuccess({ deleted: true, provider_event_id: event_id, goal_event_impact: goalEventImpact });
  } catch (err: any) {
    console.error('DELETE /api/v1/calendar/delete error:', err);
    if (err.message === ErrorCode.GOOGLE_AUTH_MISSING) {
      return apiError(ErrorCode.GOOGLE_AUTH_MISSING, 'Google OAuth token is missing. Reconnect the account.', 401);
    }
    if (err.message === ErrorCode.GOOGLE_TOKEN_REFRESH_FAILED) {
      return apiError(ErrorCode.GOOGLE_TOKEN_REFRESH_FAILED, 'Failed to refresh Google token. Reconnect the account.', 401);
    }
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
