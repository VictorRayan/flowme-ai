import dayjs from 'dayjs';

export const HOUR_HEIGHT = 60;
export const DAY_MINUTES = 24 * 60;
export const SNAP_MINUTES = 15;

export function minutesFromDayStart(value: string): number {
  const date = dayjs(value);
  return date.hour() * 60 + date.minute();
}

export function eventDurationMinutes(startAt: string, endAt?: string | null): number {
  if (!endAt) return 30;
  return Math.max(15, dayjs(endAt).diff(dayjs(startAt), 'minute'));
}

export function snapMinuteOfDay(rawMinute: number, snapMinutes = SNAP_MINUTES): number {
  const snapped = Math.floor(Math.max(0, rawMinute) / snapMinutes) * snapMinutes;
  return Math.min(DAY_MINUTES - snapMinutes, snapped);
}

export function dropYToMinuteOfDay(dropY: number, snapMinutes = SNAP_MINUTES): number {
  return snapMinuteOfDay(dropY / HOUR_HEIGHT * 60, snapMinutes);
}

export function buildDroppedEventRange(date: dayjs.Dayjs, minuteOfDay: number, durationMinutes: number) {
  const start = date.startOf('day').add(minuteOfDay, 'minute');
  return {
    start: start.toISOString(),
    end: start.add(durationMinutes, 'minute').toISOString(),
  };
}
