import dayjs from 'dayjs';

export interface MovableCalendarEvent {
  id: string;
  source: 'google';
  start_at: string;
  end_at?: string | null;
  linked_account_id?: string;
  provider_event_id?: string | null;
}

export interface MovedEventTimes {
  start_at: string;
  end_at: string;
  scheduled_date: string;
}

export interface EventMoveRequest {
  url: string;
  method: 'PATCH';
  body: Record<string, string>;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function buildMovedEventTimes(event: MovableCalendarEvent, newStart: string, newEnd?: string): MovedEventTimes {
  const oldStart = dayjs(event.start_at);
  const oldEnd = event.end_at ? dayjs(event.end_at) : null;
  const durationMinutes = oldEnd && oldEnd.isAfter(oldStart) ? oldEnd.diff(oldStart, 'minute') : 30;
  const droppedOnDateOnlyCell = DATE_ONLY_PATTERN.test(newStart);

  const finalStart = droppedOnDateOnlyCell
    ? dayjs(newStart)
        .hour(oldStart.hour())
        .minute(oldStart.minute())
        .second(oldStart.second())
        .millisecond(oldStart.millisecond())
    : dayjs(newStart);

  const finalEnd = newEnd ? dayjs(newEnd) : finalStart.add(durationMinutes, 'minute');

  return {
    start_at: finalStart.toISOString(),
    end_at: finalEnd.toISOString(),
    scheduled_date: finalStart.format('YYYY-MM-DD'),
  };
}

export function buildEventMoveRequest(event: MovableCalendarEvent, moved: MovedEventTimes): EventMoveRequest {
  if (!event.linked_account_id) {
    throw new Error('This Google event is missing its linked account. Reconnect the calendar and try again.');
  }

  return {
    url: '/api/calendar/edit-event',
    method: 'PATCH',
    body: {
      event_id: event.provider_event_id || event.id,
      linked_account_id: event.linked_account_id,
      start_at: moved.start_at,
      end_at: moved.end_at,
    },
  };
}
