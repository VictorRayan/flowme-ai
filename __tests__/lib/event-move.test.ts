import { buildEventMoveRequest, buildMovedEventTimes, MovableCalendarEvent } from '@/lib/calendar/event-move';

describe('buildMovedEventTimes', () => {
  const googleEvent: MovableCalendarEvent = {
    id: 'event-1',
    source: 'google',
    linked_account_id: 'account-1',
    start_at: '2026-05-01T10:15:00.000Z',
    end_at: '2026-05-01T11:00:00.000Z',
  };

  it('preserves original hour and duration when month view drops on a date only cell', () => {
    const moved = buildMovedEventTimes(googleEvent, '2026-05-02');

    expect(moved.start_at).toBe('2026-05-02T10:15:00.000Z');
    expect(moved.end_at).toBe('2026-05-02T11:00:00.000Z');
    expect(moved.scheduled_date).toBe('2026-05-02');
  });

  it('uses explicit newEnd when timeline views provide one', () => {
    const moved = buildMovedEventTimes(
      googleEvent,
      '2026-05-02T13:30:00.000Z',
      '2026-05-02T14:45:00.000Z'
    );

    expect(moved.start_at).toBe('2026-05-02T13:30:00.000Z');
    expect(moved.end_at).toBe('2026-05-02T14:45:00.000Z');
    expect(moved.scheduled_date).toBe('2026-05-02');
  });

  it('uses 30 minutes when an event has no end time', () => {
    const moved = buildMovedEventTimes({ ...googleEvent, end_at: null }, '2026-05-02');

    expect(moved.start_at).toBe('2026-05-02T10:15:00.000Z');
    expect(moved.end_at).toBe('2026-05-02T10:45:00.000Z');
  });
});

describe('buildEventMoveRequest', () => {
  it('builds the Google edit-event request with provider_event_id when available', () => {
    const moved = {
      start_at: '2026-05-02T10:15:00.000Z',
      end_at: '2026-05-02T11:00:00.000Z',
      scheduled_date: '2026-05-02',
    };

    const request = buildEventMoveRequest({
      id: 'local-cache-id',
      provider_event_id: 'google-event-id',
      source: 'google',
      linked_account_id: 'account-1',
      start_at: '2026-05-01T10:15:00.000Z',
    }, moved);

    expect(request.url).toBe('/api/calendar/edit-event');
    expect(request.body.event_id).toBe('google-event-id');
    expect(request.body.linked_account_id).toBe('account-1');
  });

  it('builds a local task update request for microactivities', () => {
    const moved = {
      start_at: '2026-05-02T10:15:00.000Z',
      end_at: '2026-05-02T11:00:00.000Z',
      scheduled_date: '2026-05-02',
    };

    const request = buildEventMoveRequest({
      id: 'micro-1',
      source: 'microactivity',
      start_at: '2026-05-01T10:15:00.000Z',
    }, moved);

    expect(request.url).toBe('/api/tasks/micro-1');
    expect(request.body.scheduled_date).toBe('2026-05-02');
  });

  it('rejects Google events without a linked account', () => {
    const moved = {
      start_at: '2026-05-02T10:15:00.000Z',
      end_at: '2026-05-02T11:00:00.000Z',
      scheduled_date: '2026-05-02',
    };

    expect(() => buildEventMoveRequest({
      id: 'event-1',
      source: 'google',
      start_at: '2026-05-01T10:15:00.000Z',
    }, moved)).toThrow('missing its linked account');
  });
});
