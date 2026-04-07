import { google, calendar_v3 } from 'googleapis';
import { getValidGoogleToken } from './google-auth';
import { ErrorCode } from '../api/errors';

export interface CreateEventParams {
  title: string;
  description?: string;
  startAt: string; // ISO
  endAt: string; // ISO
  createMeet?: boolean;
  participants?: string[];
  location?: string;
  reminders?: { useDefault: boolean; overrides?: Array<{ method: string; minutes: number }> };
}

export async function getCalendarEvents(linkedAccountId: string, timeMin: string, timeMax: string) {
  // Retry once on token refresh failure (handles race condition when multiple concurrent calls 
  // try to refresh the same token — the first succeeds but the others see a stale token)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const auth = await getValidGoogleToken(linkedAccountId);
      const calendar = google.calendar({ version: 'v3', auth });

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin,
        timeMax,
        maxResults: 2500,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (err: any) {
      // On first attempt, retry if it's a token refresh issue
      if (attempt === 0 && err.message === ErrorCode.GOOGLE_TOKEN_REFRESH_FAILED) {
        console.warn('Token refresh failed, retrying in 500ms...');
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      console.error('Google Calendar List Events Error:', err);
      if (err.message === ErrorCode.GOOGLE_AUTH_MISSING || err.message === ErrorCode.GOOGLE_TOKEN_REFRESH_FAILED) {
        throw err;
      }
      throw new Error(ErrorCode.GOOGLE_API_ERROR);
    }
  }
  return []; // Should never reach here, but TypeScript needs it
}

export async function createCalendarEvent(linkedAccountId: string, params: CreateEventParams) {
  try {
    const auth = await getValidGoogleToken(linkedAccountId);
    const calendar = google.calendar({ version: 'v3', auth });

    const event: calendar_v3.Schema$Event = {
        summary: params.title,
        description: params.description,
        start: { dateTime: params.startAt },
        end: { dateTime: params.endAt },
        attendees: params.participants?.map(email => ({ email })),
        location: params.location,
        reminders: params.reminders,
    };

    if (params.createMeet) {
      event.conferenceData = {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      conferenceDataVersion: params.createMeet ? 1 : 0,
      sendUpdates: 'all',
    });

    return {
      id: response.data.id!,
      htmlLink: response.data.htmlLink!,
      meetLink: response.data.hangoutLink,
    };
  } catch (err: any) {
    console.error('Google Calendar Create Event Error:', err);
    if (err.message === ErrorCode.GOOGLE_AUTH_MISSING || err.message === ErrorCode.GOOGLE_TOKEN_REFRESH_FAILED) {
        throw err;
    }
    throw new Error(ErrorCode.GOOGLE_API_ERROR);
  }
}

export async function updateCalendarEvent(linkedAccountId: string, eventId: string, params: Partial<CreateEventParams>) {
  try {
    const auth = await getValidGoogleToken(linkedAccountId);
    const calendar = google.calendar({ version: 'v3', auth });

    const event: calendar_v3.Schema$Event = {};
    if (params.title !== undefined) event.summary = params.title;
    if (params.description !== undefined) event.description = params.description;
    if (params.startAt !== undefined) event.start = { dateTime: params.startAt };
    if (params.endAt !== undefined) event.end = { dateTime: params.endAt };
    if (params.participants !== undefined) event.attendees = params.participants.map(email => ({ email }));
    if (params.location !== undefined) event.location = params.location;
    if (params.reminders !== undefined) event.reminders = params.reminders;

    if (params.createMeet) {
      event.conferenceData = {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    const response = await calendar.events.patch({
      calendarId: 'primary',
      eventId: eventId,
      requestBody: event,
      conferenceDataVersion: params.createMeet ? 1 : 0,
      sendUpdates: 'all', // Ensure participants get the update email
    });

    return {
      id: response.data.id!,
      htmlLink: response.data.htmlLink!,
      meetLink: response.data.hangoutLink,
    };
  } catch (err: any) {
    console.error('Google Calendar Update Event Error:', err);
    if (err.message === ErrorCode.GOOGLE_AUTH_MISSING || err.message === ErrorCode.GOOGLE_TOKEN_REFRESH_FAILED) {
        throw err;
    }
    throw new Error(ErrorCode.GOOGLE_API_ERROR);
  }
}
