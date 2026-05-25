const insertMock = jest.fn().mockResolvedValue({
  data: { id: 'event-1', htmlLink: 'https://calendar.google.com/event', hangoutLink: null },
});

jest.mock('googleapis', () => ({
  google: {
    calendar: jest.fn(() => ({
      events: {
        insert: insertMock,
      },
    })),
  },
}));

jest.mock('@/lib/google/google-auth', () => ({
  getValidGoogleToken: jest.fn().mockResolvedValue({}),
}));

import { createCalendarEvent } from '@/lib/google/google-calendar';

describe('createCalendarEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    insertMock.mockResolvedValue({
      data: { id: 'event-1', htmlLink: 'https://calendar.google.com/event', hangoutLink: null },
    });
  });

  it('adds timezone metadata for recurring events created from local wall-clock times', async () => {
    await createCalendarEvent('account-1', {
      title: 'Walk',
      startAt: '2026-05-25T10:00:00.000Z',
      endAt: '2026-05-25T10:15:00.000Z',
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20261231T235959Z'],
      timeZone: 'America/Sao_Paulo',
    });

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      requestBody: expect.objectContaining({
        start: { dateTime: '2026-05-25T10:00:00', timeZone: 'America/Sao_Paulo' },
        end: { dateTime: '2026-05-25T10:15:00', timeZone: 'America/Sao_Paulo' },
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20261231T235959Z'],
      }),
    }));
  });
});
