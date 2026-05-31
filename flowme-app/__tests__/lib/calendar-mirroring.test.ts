import { resolveCalendarReminderMinutes } from '@/lib/reminders/calendar-mirroring';

describe('resolveCalendarReminderMinutes', () => {
  it('uses event overrides when defaults are disabled', () => {
    expect(resolveCalendarReminderMinutes({
      useDefault: false,
      overrides: [{ minutes: 30 }, { minutes: 10 }, { minutes: 30 }],
    }, [{ minutes: 60 }])).toEqual([10, 30]);
  });

  it('uses calendar defaults when requested by the event', () => {
    expect(resolveCalendarReminderMinutes({ useDefault: true }, [{ minutes: 15 }])).toEqual([15]);
  });
});
