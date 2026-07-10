const mockRequireFeature = jest.fn();

jest.mock('@/lib/billing/entitlements', () => {
  class FeatureLockedError extends Error {
    feature: string;
    required_plan = 'pro';
    constructor(feature: string) { super('Feature requires Flow Me Pro'); this.name = 'FeatureLockedError'; this.feature = feature; }
  }
  return { FeatureLockedError, requireFeature: (...args: unknown[]) => mockRequireFeature(...args) };
});

jest.mock('@/lib/google/google-calendar', () => ({
  getCalendarEvents: jest.fn().mockResolvedValue([]),
  getCalendarEvent: jest.fn(),
  createCalendarEvent: jest.fn(),
  updateCalendarEvent: jest.fn(),
  deleteCalendarEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/goals/calendar-event-links', () => ({
  markGoalCalendarEventDeleted: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/calendar/event-reschedule-history', () => ({
  listCalendarReschedules: jest.fn().mockResolvedValue([]),
  recordCalendarReschedule: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/today/event-outcomes', () => ({
  listEventOutcomes: jest.fn().mockResolvedValue(new Map()),
}));

import { calendarDeleteEventTool, calendarDeleteEventsBatchTool, calendarListEventsTool } from '@/lib/ai/tools/calendar-tools';
import { deleteCalendarEvent, getCalendarEvents } from '@/lib/google/google-calendar';

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
  return { from: jest.fn().mockReturnValue(chain) };
}

function makeContext(): any {
  return {
    supabase: makeSupabase(),
    user: { id: 'user-1', email: 'victor@example.com' },
    timezone: 'America/Sao_Paulo',
    nowIso: '2026-07-10T12:00:00.000Z',
  };
}

const GOOGLE_ID = '4qps7dog5jth3gunr0ktutu9ns';
const INSTANCE_ID = '4qps7dog5jth3gunr0ktutu9ns_20260709T230000Z';
const APP_UUID = '6131c93a-4467-427c-959c-882208169623';

describe('calendar.delete_events_batch hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireFeature.mockResolvedValue({ features: { calendar: true } });
    (deleteCalendarEvent as jest.Mock).mockResolvedValue(undefined);
  });

  it('rejects internal app UUIDs per-id without calling Google', async () => {
    const result = await calendarDeleteEventsBatchTool.call({ event_ids: [APP_UUID, GOOGLE_ID] }, makeContext());

    expect(result.ok).toBe(true);
    expect((result.receipt as any).deleted_count).toBe(1);
    expect((result.receipt as any).failed_count).toBe(1);
    const failed = (result.receipt as any).results.find((r: any) => r.status === 'failed');
    expect(failed.event_id).toBe(APP_UUID);
    expect(failed.error).toContain('not a Google Calendar event ID');
    expect(failed.error).toContain('recurring_event_id');
    expect(deleteCalendarEvent).toHaveBeenCalledTimes(1);
    expect(deleteCalendarEvent).toHaveBeenCalledWith('linked-account-1', GOOGLE_ID, expect.anything());
  });

  it('deduplicates repeated event ids before deleting', async () => {
    const result = await calendarDeleteEventsBatchTool.call(
      { event_ids: [GOOGLE_ID, GOOGLE_ID, GOOGLE_ID, INSTANCE_ID] },
      makeContext(),
    );

    expect(result.ok).toBe(true);
    expect((result.receipt as any).requested_count).toBe(2);
    expect((result.receipt as any).deleted_count).toBe(2);
    expect(deleteCalendarEvent).toHaveBeenCalledTimes(2);
  });

  it('keeps the 50-id safety cap and points the model at recurring_event_id', async () => {
    const ids = Array.from({ length: 55 }, (_, i) => `${GOOGLE_ID}_2026071${i % 10}T230000Z${i}`);
    const result = await calendarDeleteEventsBatchTool.call({ event_ids: ids }, makeContext());

    expect(result.ok).toBe(false);
    expect(result.error).toContain('safety cap of 50');
    expect(result.error).toContain('recurring_event_id');
    expect(deleteCalendarEvent).not.toHaveBeenCalled();
  });

  it('reports partial failure in the summary when some deletions fail', async () => {
    (deleteCalendarEvent as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ response: { data: { error: { code: 404, message: 'Not Found' } } } });

    const result = await calendarDeleteEventsBatchTool.call(
      { event_ids: [GOOGLE_ID, INSTANCE_ID] },
      makeContext(),
    );

    expect(result.ok).toBe(true);
    expect((result.receipt as any).deleted_count).toBe(1);
    expect((result.receipt as any).failed_count).toBe(1);
    expect((result.receipt as any).summary).toContain('PARTIAL FAILURE');
    expect((result.receipt as any).summary).toContain('Google API 404');
  });
});

describe('calendar.delete_event id validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireFeature.mockResolvedValue({ features: { calendar: true } });
  });

  it('rejects an internal app UUID before touching Google', async () => {
    const result = await calendarDeleteEventTool.call({ event_id: APP_UUID }, makeContext());

    expect(result.ok).toBe(false);
    expect(result.error).toContain('not a Google Calendar event ID');
    expect(deleteCalendarEvent).not.toHaveBeenCalled();
  });

  it('accepts recurring instance ids with timestamp suffix', async () => {
    const result = await calendarDeleteEventTool.call({ event_id: INSTANCE_ID }, makeContext());

    expect(result.ok).toBe(true);
    expect(deleteCalendarEvent).toHaveBeenCalledWith('linked-account-1', INSTANCE_ID, expect.anything());
  });
});

describe('calendar.list_events recurring series exposure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireFeature.mockResolvedValue({ features: { calendar: true } });
  });

  it('returns recurring_event_id for instances of a recurring series', async () => {
    (getCalendarEvents as jest.Mock).mockResolvedValueOnce([
      {
        id: INSTANCE_ID,
        recurringEventId: GOOGLE_ID,
        summary: 'Treino',
        start: { dateTime: '2026-07-09T20:00:00-03:00' },
        end: { dateTime: '2026-07-09T21:00:00-03:00' },
      },
      {
        id: 'one0ffevent123',
        summary: 'Dentista',
        start: { dateTime: '2026-07-09T09:00:00-03:00' },
        end: { dateTime: '2026-07-09T10:00:00-03:00' },
      },
    ]);

    const result = await calendarListEventsTool.call(
      { start_iso: '2026-07-09T00:00:00-03:00', end_iso: '2026-07-10T00:00:00-03:00', limit: 0 },
      makeContext(),
    );

    expect(result.ok).toBe(true);
    const events = (result.receipt as any).events;
    expect(events.find((e: any) => e.id === INSTANCE_ID).recurring_event_id).toBe(GOOGLE_ID);
    expect(events.find((e: any) => e.id === 'one0ffevent123').recurring_event_id).toBeNull();
  });
});
