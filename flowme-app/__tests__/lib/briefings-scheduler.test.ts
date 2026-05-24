import { isSlotDue, minutesIn } from '@/lib/briefings/scheduler';

describe('isSlotDue', () => {
  it('fires within 1 minute of slot_time - 3min', () => {
    // morning 07:00 → trigger at 06:57
    expect(isSlotDue('07:00', 6 * 60 + 57)).toBe(true);
    expect(isSlotDue('07:00', 6 * 60 + 56)).toBe(true);
    expect(isSlotDue('07:00', 6 * 60 + 58)).toBe(true);
    expect(isSlotDue('07:00', 6 * 60 + 55)).toBe(false);
    expect(isSlotDue('07:00', 6 * 60 + 59)).toBe(false);
  });

  it('handles midnight wraparound', () => {
    // 00:02 → trigger at 23:59 of the previous day
    expect(isSlotDue('00:02', 23 * 60 + 59)).toBe(true);
  });

  it('rejects invalid time strings', () => {
    expect(isSlotDue(null, 0)).toBe(false);
    expect(isSlotDue('25:00', 0)).toBe(false);
    expect(isSlotDue('7h', 0)).toBe(false);
  });
});

describe('minutesIn', () => {
  it('parses HH:MM', () => {
    expect(minutesIn('07:00')).toBe(420);
    expect(minutesIn('00:30')).toBe(30);
  });

  it('rejects non-HH:MM', () => {
    expect(minutesIn('7h')).toBe(null);
    expect(minutesIn(null)).toBe(null);
  });
});
