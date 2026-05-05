import dayjs from 'dayjs';
import {
  buildDroppedEventRange,
  dropYToMinuteOfDay,
  eventDurationMinutes,
  minutesFromDayStart,
  snapMinuteOfDay,
} from '@/lib/calendar/time-grid';

describe('time grid helpers', () => {
  it('calculates minutes from day start', () => {
    expect(minutesFromDayStart('2026-05-01T07:30:00')).toBe(450);
  });

  it('uses event duration when end time exists', () => {
    expect(eventDurationMinutes('2026-05-01T07:30:00.000Z', '2026-05-01T09:00:00.000Z')).toBe(90);
  });

  it('uses 30 minutes when end time is missing', () => {
    expect(eventDurationMinutes('2026-05-01T07:30:00.000Z', null)).toBe(30);
  });

  it('snaps dropped minutes to 15 minute increments', () => {
    expect(snapMinuteOfDay(613)).toBe(600);
    expect(snapMinuteOfDay(629)).toBe(615);
  });

  it('converts vertical pixels to snapped minute of day', () => {
    expect(dropYToMinuteOfDay(615)).toBe(615);
  });

  it('builds a dropped event range on the selected day', () => {
    const range = buildDroppedEventRange(dayjs('2026-05-01'), 615, 90);

    expect(dayjs(range.start).format('YYYY-MM-DD HH:mm')).toBe('2026-05-01 10:15');
    expect(dayjs(range.end).format('YYYY-MM-DD HH:mm')).toBe('2026-05-01 11:45');
  });
});
