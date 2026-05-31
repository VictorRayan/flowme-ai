jest.mock('@/lib/google/google-calendar', () => ({
  getCalendarEvents: jest.fn().mockResolvedValue([
    {
      id: 'event-1',
      summary: 'Agenda item',
      start: { dateTime: '2026-05-06T09:00:00-03:00' },
      end: { dateTime: '2026-05-06T10:00:00-03:00' },
    },
  ]),
  getCalendarEvent: jest.fn().mockResolvedValue({
    id: 'event-1',
    summary: 'Agenda item',
    start: { dateTime: '2026-05-06T09:00:00-03:00' },
    end: { dateTime: '2026-05-06T10:00:00-03:00' },
  }),
  createCalendarEvent: jest.fn().mockResolvedValue({ id: 'created-1', htmlLink: 'https://calendar.google.com/event', meetLink: null }),
  updateCalendarEvent: jest.fn(),
  deleteCalendarEvent: jest.fn(),
}));

jest.mock('@/lib/calendar/event-reschedule-history', () => ({
  listCalendarReschedules: jest.fn().mockResolvedValue([]),
  recordCalendarReschedule: jest.fn().mockResolvedValue(undefined),
}));

import { calendarCreateEventTool, calendarListEventsTool, calendarListRescheduleHistoryTool } from '@/lib/ai/tools/calendar-tools';
import { createCalendarEvent, getCalendarEvents } from '@/lib/google/google-calendar';
import { listCalendarReschedules } from '@/lib/calendar/event-reschedule-history';

function makeSupabase(accounts = [{ id: 'linked-account-1', name: 'Work', type: 'work' }]) {
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data: accounts, error: null }).then(resolve as any, reject as any);
    },
    catch(reject: Function) {
      return Promise.resolve({ data: accounts, error: null }).catch(reject as any);
    },
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

  it('returns human-readable reschedule evidence without provider IDs', async () => {
    (listCalendarReschedules as jest.Mock).mockResolvedValueOnce([{
      event_title: 'Deep work',
      movement_type: 'postponed',
      offset_minutes: 120,
      total_offset_minutes: 180,
      minutes_before_previous_start: 30,
      changed_at: '2026-05-06T12:00:00.000Z',
      provider_event_id: 'internal-event-id',
    }]);
    const result = await calendarListRescheduleHistoryTool.call({}, {
      supabase: {},
      user: { id: 'user-1' },
      timezone: 'America/Sao_Paulo',
      nowIso: '2026-05-06T22:10:00.000Z',
    });

    expect(result.ok).toBe(true);
    expect(result.receipt).toEqual(expect.objectContaining({
      postponed_count: 1,
      late_postponement_count: 1,
      changes: [expect.objectContaining({ title: 'Deep work', offset_minutes: 120 })],
    }));
    expect(JSON.stringify(result.receipt)).not.toContain('internal-event-id');
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
      limit: 50,
    }, context);

    expect(result.ok).toBe(true);
    expect(getCalendarEvents).toHaveBeenCalledWith(
      'linked-account-1',
      '2026-05-06T00:00:00-03:00',
      '2026-05-07T00:00:00-03:00',
      context,
    );
  });

  it('asks for a calendar nickname before creating when multiple Google accounts exist', async () => {
    const { from } = makeSupabase([
      { id: 'work-id', name: 'Work', type: 'work' },
      { id: 'personal-id', name: 'Personal', type: 'personal' },
    ]);
    const context: any = {
      supabase: { from },
      user: { id: 'user-1', email: 'victor@example.com' },
      timezone: 'America/Sao_Paulo',
      nowIso: '2026-05-06T22:10:00.000Z',
    };

    const result = await calendarCreateEventTool.call({
      title: 'Meeting',
      start_iso: '2026-05-07T09:00:00-03:00',
      end_iso: '2026-05-07T10:00:00-03:00',
    }, context);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Which calendar account');
    expect(createCalendarEvent).not.toHaveBeenCalled();
  });

  it('uses the requested account nickname when creating calendar events', async () => {
    const { from } = makeSupabase([
      { id: 'work-id', name: 'Work', type: 'work' },
      { id: 'personal-id', name: 'Personal', type: 'personal' },
    ]);
    const context: any = {
      supabase: { from },
      user: { id: 'user-1', email: 'victor@example.com' },
      timezone: 'America/Sao_Paulo',
      nowIso: '2026-05-06T22:10:00.000Z',
    };

    const result = await calendarCreateEventTool.call({
      title: 'Meeting',
      start_iso: '2026-05-07T09:00:00-03:00',
      end_iso: '2026-05-07T10:00:00-03:00',
      account_nickname: 'Personal',
    }, context);

    expect(result.ok).toBe(true);
    expect(createCalendarEvent).toHaveBeenCalledWith(
      'personal-id',
      expect.objectContaining({ title: 'Meeting' }),
      context,
    );
  });
});
