import { NextRequest } from 'next/server';
import { requireApiKeyAuth } from '@/lib/api/api-key-auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { getCalendarEvents } from '@/lib/google/google-calendar';

/**
 * GET /api/v1/calendar/events
 * List calendar events for the authenticated user.
 *
 * Query params:
 *   - start (required): ISO date string
 *   - end (required): ISO date string
 *   - include_flowme_events: "true" to include Flowme-native events
 *   - include_google_events: "true" to include Google Calendar events
 *   - account_ids: comma-separated linked account IDs
 *
 * Auth: Bearer <api_key> with scope "calendar.read"
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiKeyAuth(req, ['calendar.read']);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;

    const url = new URL(req.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    const includeFlowmeEvents = url.searchParams.get('include_flowme_events') === 'true'
      || url.searchParams.get('include_microactivities') === 'true';
    const includeGoogleEvents = url.searchParams.get('include_google_events') !== 'false'; // default true
    const accountIdsParam = url.searchParams.get('account_ids');

    if (!start || !end) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'start and end query parameters are required (ISO date strings)');
    }

    const accountIds = accountIdsParam ? accountIdsParam.split(',').filter(Boolean) : null;
    const aggregatedEvents: any[] = [];

    if (includeFlowmeEvents) {
      const { data: flowmeEvents, error: mError } = await supabase
        .from('microactivities')
        .select('id, title, description, start_at, end_at')
        .eq('user_id', userId)
        .gte('start_at', start)
        .lt('start_at', end);

      if (mError) throw mError;

      if (flowmeEvents) {
        aggregatedEvents.push(
          ...flowmeEvents.map((m: any) => ({
            source: 'flowme',
            id: m.id,
            title: m.title,
            description: m.description,
            start_at: m.start_at,
            end_at: m.end_at,
          }))
        );
      }
    }

    // 2. Fetch Google Calendar Events
    if (includeGoogleEvents) {
      let accountsQuery = supabase
        .from('linked_accounts')
        .select('id, name, type, provider')
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .eq('provider', 'google');

      if (accountIds && accountIds.length > 0) {
        accountsQuery = accountsQuery.in('id', accountIds);
      }

      const { data: accounts, error: aError } = await accountsQuery;
      if (aError) throw aError;

      if (accounts && accounts.length > 0) {
        const googleEventPromises = accounts.map(async (account: any) => {
          try {
            const events = await getCalendarEvents(account.id, new Date(start).toISOString(), new Date(end).toISOString());
            return events.filter((e: any) => e.start?.dateTime || e.start?.date).map((e: any) => ({
              source: 'google',
              id: e.id!,
              linked_account_id: account.id,
              account_name: account.name,
              title: e.summary || 'Untitled Event',
              description: e.description || null,
              start_at: e.start?.dateTime || e.start?.date,
              end_at: e.end?.dateTime || e.end?.date || null,
              meet_link: e.hangoutLink || null,
              participants: e.attendees?.map((a: any) => ({ email: a.email, name: a.displayName })) || [],
              location: e.location || null,
              html_link: e.htmlLink || null,
            }));
          } catch {
            return [];
          }
        });

        const results = await Promise.all(googleEventPromises);
        for (const batch of results) {
          aggregatedEvents.push(...batch);
        }
      }
    }

    // Sort by start_at
    aggregatedEvents.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

    return apiSuccess({ events: aggregatedEvents, count: aggregatedEvents.length });
  } catch (err: any) {
    console.error('GET /api/v1/calendar/events error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
