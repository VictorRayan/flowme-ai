const insertMock = jest.fn().mockResolvedValue({
  data: { id: 'event-1', htmlLink: 'https://calendar.google.com/event', hangoutLink: null },
});
const patchMock = jest.fn().mockResolvedValue({
  data: { id: 'event-1', htmlLink: 'https://calendar.google.com/event', hangoutLink: null },
});

jest.mock('googleapis', () => ({
  google: {
    calendar: jest.fn(() => ({
      events: {
        insert: insertMock,
        patch: patchMock,
      },
    })),
  },
}));

jest.mock('@/lib/google/google-auth', () => ({
  getValidGoogleToken: jest.fn().mockResolvedValue({}),
}));

import { createCalendarEvent, updateCalendarEvent } from '@/lib/google/google-calendar';

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

describe('updateCalendarEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    patchMock.mockResolvedValue({
      data: { id: 'event-1', htmlLink: 'https://calendar.google.com/event', hangoutLink: null },
    });
  });

  it('patches a new recurrence rule when a goal series is remanaged', async () => {
    await updateCalendarEvent('account-1', 'event-1', {
      startAt: '2026-05-30T21:00:00-03:00',
      endAt: '2026-05-31T00:00:00.000Z',
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=SA,SU;UNTIL=20261231T235959Z'],
    });

    expect(patchMock).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'event-1',
      requestBody: expect.objectContaining({
        start: { dateTime: '2026-05-30T21:00:00-03:00' },
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=SA,SU;UNTIL=20261231T235959Z'],
      }),
    }));
  });

  it('keeps the plain dateTime shape when no timezone is supplied', async () => {
    await updateCalendarEvent('account-1', 'event-1', {
      startAt: '2026-05-30T21:00:00.000Z',
    });

    expect(patchMock).toHaveBeenCalledWith(expect.objectContaining({
      requestBody: expect.objectContaining({
        start: { dateTime: '2026-05-30T21:00:00.000Z' },
      }),
    }));
  });
});
