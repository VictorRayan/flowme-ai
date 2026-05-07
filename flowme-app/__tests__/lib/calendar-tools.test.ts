jest.mock('@/lib/google/google-calendar', () => ({
  getCalendarEvents: jest.fn().mockResolvedValue([
    {
      id: 'event-1',
      summary: 'Agenda item',
      start: { dateTime: '2026-05-06T09:00:00-03:00' },
      end: { dateTime: '2026-05-06T10:00:00-03:00' },
    },
  ]),
  createCalendarEvent: jest.fn(),
  updateCalendarEvent: jest.fn(),
  deleteCalendarEvent: jest.fn(),
}));

import { calendarListEventsTool } from '@/lib/ai/tools/calendar-tools';
import { getCalendarEvents } from '@/lib/google/google-calendar';

function makeSupabase() {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'linked-account-1' }, error: null }),
  };
  return {
    from: jest.fn().mockReturnValue(chain),
    chain,
  };
}

describe('calendar tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes the tool context to Google Calendar reads for non-browser auth flows', async () => {
    const { from } = makeSupabase();
    const context: any = {
      supabase: { from },
      user: { id: 'user-1', email: 'victor@example.com' },
      timezone: 'America/Sao_Paulo',
      nowIso: '2026-05-06T22:10:00.000Z',
    };

    const result = await calendarListEventsTool.call({
      start_iso: '2026-05-06T00:00:00-03:00',
      end_iso: '2026-05-07T00:00:00-03:00',
    }, context);

    expect(result.ok).toBe(true);
    expect(getCalendarEvents).toHaveBeenCalledWith(
      'linked-account-1',
      '2026-05-06T00:00:00-03:00',
      '2026-05-07T00:00:00-03:00',
      context,
    );
  });
});
