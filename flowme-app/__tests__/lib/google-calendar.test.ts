const insertMock = jest.fn().mockResolvedValue({
  data: { id: 'event-1', htmlLink: 'https://calendar.google.com/event', hangoutLink: null },
});
const patchMock = jest.fn().mockResolvedValue({
  data: { id: 'event-1', htmlLink: 'https://calendar.google.com/event', hangoutLink: null },
});
const getMock = jest.fn().mockResolvedValue({
  data: { id: 'event-1', summary: 'Deep work' },
});
const calendarListGetMock = jest.fn().mockResolvedValue({
  data: { defaultReminders: [{ method: 'popup', minutes: 30 }] },
});

jest.mock('googleapis', () => ({
  google: {
    calendar: jest.fn(() => ({
      events: {
        insert: insertMock,
        patch: patchMock,
        get: getMock,
      },
      calendarList: { get: calendarListGetMock },
    })),
  },
}));

jest.mock('@/lib/google/google-auth', () => ({
  getValidGoogleToken: jest.fn().mockResolvedValue({}),
}));

import { createCalendarEvent, getCalendarDefaultReminders, getCalendarEvent, updateCalendarEvent } from '@/lib/google/google-calendar';

describe('getCalendarEvent', () => {
  it('loads the current provider allocation before rescheduling', async () => {
    await expect(getCalendarEvent('account-1', 'event-1')).resolves.toEqual({ id: 'event-1', summary: 'Deep work' });
    expect(getMock).toHaveBeenCalledWith({ calendarId: 'primary', eventId: 'event-1' });
  });
});

describe('getCalendarDefaultReminders', () => {
  it('loads reminder defaults for useDefault events', async () => {
    await expect(getCalendarDefaultReminders('account-1')).resolves.toEqual([{ method: 'popup', minutes: 30 }]);
  });
});

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
