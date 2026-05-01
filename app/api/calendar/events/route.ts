import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { getCalendarEvents } from '@/lib/google/google-calendar';

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth();
    
    const url = new URL(req.url);
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    const includeMicroactivities = url.searchParams.get('includeMicroactivities') === 'true';
    const includeGoogleEvents = url.searchParams.get('includeGoogleEvents') === 'true';
    const accountIdsParam = url.searchParams.get('accountIds');
    const accountTypesParam = url.searchParams.get('accountTypes');

    if (!start || !end) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'start and end parameters required');
    }

    const accountIds = accountIdsParam ? accountIdsParam.split(',').filter(Boolean) : null;
    const accountTypes = accountTypesParam ? accountTypesParam.split(',').filter(Boolean) : null;

    let aggregatedEvents: any[] = [];

    // 1. Fetch Microactivities
    if (includeMicroactivities) {
      const { data: microactivities, error: mError } = await supabase
        .from('microactivities')
        .select('id, title, description, start_at, end_at')
        .eq('user_id', user.id)
        .gte('start_at', start)
        .lt('start_at', end);

      if (mError) throw mError;

      if (microactivities) {
        aggregatedEvents.push(
          ...microactivities.map(m => ({
            source: 'microactivity',
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
      // Get all active linked accounts
      let accountsQuery = supabase
        .from('linked_accounts')
        .select('id, name, type, provider')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .eq('is_deleted', false)
        .eq('provider', 'google');

      if (accountIds && accountIds.length > 0) {
        accountsQuery = accountsQuery.in('id', accountIds);
      }
      if (accountTypes && accountTypes.length > 0) {
        accountsQuery = accountsQuery.in('type', accountTypes);
      }

      const { data: accounts, error: aError } = await accountsQuery;
      if (aError) throw aError;

      if (accounts && accounts.length > 0) {
        // Fetch from Google for each connected account concurrently
        const googleEventPromises = accounts.map(async (account) => {
          try {
            const events = await getCalendarEvents(account.id, new Date(start).toISOString(), new Date(end).toISOString());
            const mapped = events.filter(e => e.start?.dateTime || e.start?.date).map(e => ({
              source: 'google',
              id: e.id!,
              provider_event_id: e.id!,
              linked_account_id: account.id,
              account_name: account.name,
              account_type: account.type,
              title: e.summary || 'Untitled Event',
              description: e.description || null,
              start_at: e.start?.dateTime || e.start?.date,
              end_at: e.end?.dateTime || e.end?.date || null,
              meet_link: e.hangoutLink || null,
              participants: e.attendees?.map(a => ({ email: a.email, displayName: a.displayName })) || [],
              location: e.location || null,
              htmlLink: e.htmlLink || null,
            }));
            return mapped;
          } catch (err: any) {
            console.error(`Error fetching events for account ${account.name} (${account.id}):`, err?.message || err);
            return [];
          }
        });

        const accountsEvents = await Promise.all(googleEventPromises);
        for (const evBatch of accountsEvents) {
          aggregatedEvents.push(...evBatch);
        }
      }
    }

    // Sort all aggregated events by start_at
    aggregatedEvents.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

    return apiSuccess({ events: aggregatedEvents });
  } catch (err: any) {
    if (err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('GET /api/calendar/events error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
