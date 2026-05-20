import { z } from 'zod';
import { defineTool, ToolContext } from './Tool';
import { createCalendarEvent, deleteCalendarEvent, getCalendarEvents, updateCalendarEvent } from '@/lib/google/google-calendar';

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const GOOGLE_LIMITS = {
  TITLE_MAX: 1024,
  DESCRIPTION_MAX: 8192,
  LOCATION_MAX: 1024,
  PARTICIPANTS_MAX: 200,
};

function normalizeIsoWithOffset(iso: string, fallbackTimezone: string): string | null {
  if (!iso || typeof iso !== 'string') return null;
  const trimmed = iso.trim();
  if (/[zZ]$/.test(trimmed) || /[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : trimmed;
  }
  const naive = trimmed.match(/^(\d{4}-\d{2}-\d{2})[Tt ](\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)$/);
  if (!naive) return null;
  const dateTimeStr = `${naive[1]}T${naive[2]}`;
  const offsetMinutes = (() => {
    try {
      const probe = new Date(`${dateTimeStr}Z`);
      const formatted = new Intl.DateTimeFormat('en-US', {
        timeZone: fallbackTimezone,
        timeZoneName: 'shortOffset',
        hour: 'numeric',
      }).formatToParts(probe).find((p) => p.type === 'timeZoneName')?.value || '';
      const m = formatted.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
      if (m) {
        const sign = m[1] === '-' ? -1 : 1;
        return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3] || '0', 10));
      }
    } catch {}
    return 0;
  })();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${dateTimeStr}${sign}${hh}:${mm}`;
}

interface NormalizedEvent {
  title: string;
  startAt: string;
  endAt: string;
  description?: string;
  location?: string;
  createMeet?: boolean;
  participants?: string[];
}

interface GoogleAccount {
  id: string;
  name: string;
  type?: string | null;
}

function normalizeAccountLabel(input: string | null | undefined): string {
  return String(input || '').trim().toLowerCase();
}

function renderAccountOptions(accounts: GoogleAccount[]): string {
  return accounts.map(account => account.name).join(', ');
}

function validateAndNormalizeCreateArgs(args: any, timezone: string): { ok: true; normalized: NormalizedEvent } | { ok: false; error: string } {
  const title = (args.title || '').trim();
  if (!title) return { ok: false, error: 'title is required and cannot be empty' };
  if (title.length > GOOGLE_LIMITS.TITLE_MAX) {
    return { ok: false, error: `title exceeds Google Calendar limit of ${GOOGLE_LIMITS.TITLE_MAX} chars` };
  }

  const start = normalizeIsoWithOffset(args.start_iso, timezone);
  if (!start) return { ok: false, error: `start_iso is not a valid ISO 8601 datetime ("${args.start_iso}"). Expected format like 2026-05-01T23:00:00-03:00 or 2026-05-01T23:00:00 (the user's timezone will be applied).` };

  let end = normalizeIsoWithOffset(args.end_iso, timezone);
  if (!end) {
    const startDate = new Date(start);
    if (isNaN(startDate.getTime())) return { ok: false, error: 'start_iso could not be parsed' };
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    end = endDate.toISOString();
  }

  if (new Date(end).getTime() <= new Date(start).getTime()) {
    return { ok: false, error: 'end_iso must be strictly after start_iso' };
  }

  const description = args.description ? String(args.description).slice(0, GOOGLE_LIMITS.DESCRIPTION_MAX) : undefined;
  const location = args.location ? String(args.location).slice(0, GOOGLE_LIMITS.LOCATION_MAX) : undefined;

  let participants: string[] | undefined;
  if (Array.isArray(args.participants) && args.participants.length > 0) {
    const valid = args.participants
      .map((p: unknown) => (typeof p === 'string' ? p.trim() : ''))
      .filter((p: string) => EMAIL_RE.test(p));
    if (valid.length === 0) {
      participants = undefined;
    } else if (valid.length > GOOGLE_LIMITS.PARTICIPANTS_MAX) {
      return { ok: false, error: `too many participants: ${valid.length} (max ${GOOGLE_LIMITS.PARTICIPANTS_MAX})` };
    } else {
      participants = Array.from(new Set(valid));
    }
  }

  return {
    ok: true,
    normalized: {
      title,
      startAt: start,
      endAt: end,
      description,
      location,
      createMeet: Boolean(args.create_meet),
      participants,
    },
  };
}

async function listGoogleAccounts(context: ToolContext): Promise<GoogleAccount[]> {
  const { data, error } = await context.supabase
    .from('linked_accounts')
    .select('id, name, type')
    .eq('user_id', context.user.id)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .eq('provider', 'google')
    .order('created_at', { ascending: true });

  if (error || !Array.isArray(data)) return [];
  return data;
}

async function resolveGoogleAccount(
  context: ToolContext,
  accountNickname: string | undefined,
  requireNicknameWhenMultiple: boolean,
): Promise<{ ok: true; account: GoogleAccount } | { ok: false; error: string }> {
  const accounts = await listGoogleAccounts(context);
  if (accounts.length === 0) {
    return { ok: false, error: 'No active Google account connected.' };
  }

  const wanted = normalizeAccountLabel(accountNickname);
  if (wanted) {
    const exact = accounts.find(account =>
      normalizeAccountLabel(account.name) === wanted ||
      normalizeAccountLabel(account.type) === wanted
    );
    const partial = exact || accounts.find(account => normalizeAccountLabel(account.name).includes(wanted));
    if (partial) return { ok: true, account: partial };

    return { ok: false, error: `I could not find a Google Calendar account called "${accountNickname}". Available account nicknames: ${renderAccountOptions(accounts)}.` };
  }

  if (accounts.length > 1 && requireNicknameWhenMultiple) {
    return { ok: false, error: `Which calendar account should I use? Available account nicknames: ${renderAccountOptions(accounts)}.` };
  }

  return { ok: true, account: accounts[0] };
}

export const calendarListEventsTool = defineTool({
  name: 'calendar.list_events',
  description: `Reads events from the user's primary Google Calendar. Returns ALL matching events in the window, sorted by start_at ascending.

WHEN TO USE: user asks "what's on my calendar", "am I free Thursday", "do I have a meeting with X", "find my dentist appointment", "what events do I have today", "what's on tomorrow", "show me everything between hoje e amanhã"; or any time you need event_ids before calling update_event / delete_event / delete_events_batch.

CONTRACT:
- All inputs optional. If start_iso is omitted, defaults to start of TODAY in the user's timezone. If end_iso is omitted, defaults to start_iso + 14 days.
- "today" → start_iso=today 00:00, end_iso=today 23:59 in user's timezone.
- "today and tomorrow" / "hoje e amanhã" → start_iso=today 00:00, end_iso=tomorrow 23:59.
- "this week" → start_iso=today, end_iso=today+7 days.
- For multi-event operations, set limit=0 (no cap) and process the full list.
- query filters in-memory by title/description substring (case-insensitive) AFTER the date-range fetch — it does NOT expand the date range. To search "any meeting with Anna ever", widen start_iso/end_iso explicitly. Omit query to get every event in the range.
- Read-only. Safe to call multiple times.

RETURNS receipt.events[]: { id, title, description, location, start_at, end_at }, sorted ascending by start_at.
- id is a Google event ID — TECHNICAL, never read it aloud or show it. Keep it for chaining into update_event / delete_event / delete_events_batch.
- start_at / end_at are ISO strings — convert to the user's timezone before quoting times back to them.
- count is the total number of events in the window (also surfaced in receipt.count).

For "delete all events tomorrow" type requests:
1. Call list_events with start_iso/end_iso covering tomorrow, query omitted, limit=0
2. Collect all event_ids from receipt.events
3. Call delete_events_batch with those ids
4. Confirm to the user how many were deleted.

ASK THE USER FIRST IF: they ask about "next week" / "Friday" with ambiguous bounds AND the answer matters (e.g. before scheduling). Otherwise infer reasonable bounds and proceed.`,
  isReadOnly: true,
  inputSchema: z.object({
    start_iso: z.string().optional().describe('Inclusive start of the window in ISO 8601. Defaults to start of today in the user\'s timezone.'),
    end_iso: z.string().optional().describe('Exclusive end of the window in ISO 8601. Defaults to start_iso + 14 days.'),
    query: z.string().optional().describe('Substring filter applied to event title or description after fetch. Case-insensitive. Omit to return all events in the range.'),
    account_nickname: z.string().optional().describe('Optional linked Google account nickname/name. Omit to read all active calendar accounts.'),
    limit: z.number().optional().default(50).describe('Max events returned (post-filter). Default 50. Pass 0 for no limit (use for batch operations).'),
  }),
  call: async (args, context) => {
    const accounts = args.account_nickname
      ? null
      : await listGoogleAccounts(context);
    if (!args.account_nickname && (!accounts || accounts.length === 0)) {
      return { ok: false, error: 'No active Google account connected.' };
    }

    const selectedAccount = args.account_nickname
      ? await resolveGoogleAccount(context, args.account_nickname, false)
      : null;
    if (selectedAccount && !selectedAccount.ok) return { ok: false, error: selectedAccount.error };

    const tz = context.timezone || 'UTC';
    const startInputRaw = args.start_iso || context.nowIso;
    const startIso = normalizeIsoWithOffset(startInputRaw, tz);
    if (!startIso) {
      return { ok: false, error: `start_iso is not a valid ISO 8601 datetime ("${args.start_iso}"). Use format like 2026-05-01T00:00:00-03:00.` };
    }

    let endIso: string;
    if (args.end_iso) {
      const normalized = normalizeIsoWithOffset(args.end_iso, tz);
      if (!normalized) {
        return { ok: false, error: `end_iso is not a valid ISO 8601 datetime ("${args.end_iso}").` };
      }
      endIso = normalized;
    } else {
      const endDate = new Date(startIso);
      endDate.setUTCDate(endDate.getUTCDate() + 14);
      endIso = endDate.toISOString();
    }

    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      return { ok: false, error: 'end_iso must be strictly after start_iso' };
    }

    try {
      const accountsToRead = selectedAccount?.ok ? [selectedAccount.account] : accounts!;
      const eventBatches = await Promise.all(accountsToRead.map(async (account) => {
        const events = await getCalendarEvents(account.id, startIso, endIso, context);
        return (events || []).map(e => ({
          id: e.id,
          linked_account_id: account.id,
          account_nickname: account.name,
          title: e.summary || 'Untitled Event',
          description: e.description || null,
          location: e.location || null,
          start_at: e.start?.dateTime || e.start?.date,
          end_at: e.end?.dateTime || e.end?.date,
        })).filter(e => e.start_at);
      }));
      let mapped = eventBatches.flat();

      if (args.query) {
        const q = args.query.toLowerCase();
        mapped = mapped.filter(e =>
          e.title.toLowerCase().includes(q) ||
          (e.description && e.description.toLowerCase().includes(q))
        );
      }

      mapped.sort((a, b) => (a.start_at || '').localeCompare(b.start_at || ''));

      const limit = typeof args.limit === 'number' ? args.limit : 50;
      const limited = limit === 0 ? mapped : mapped.slice(0, limit);

      return {
        ok: true,
        receipt: {
          events: limited,
          count: limited.length,
          accounts: accountsToRead.map(account => account.name),
          window: { start: startIso, end: endIso },
        },
      };
    } catch (e: any) {
      const googleMsg = e?.response?.data?.error?.message || e?.errors?.[0]?.message || e?.message;
      const errCode = e?.response?.data?.error?.code || e?.code;
      const detailedError = errCode && googleMsg ? `Google API ${errCode}: ${googleMsg}` : (googleMsg || 'Failed to list events');
      console.error('[calendar.list_events] Google API error:', { errCode, googleMsg, startIso, endIso, query: args.query });
      return { ok: false, error: detailedError };
    }
  }
});

export const calendarCreateEventTool = defineTool({
  name: 'calendar.create_event',
  description: `Creates a new event on the user's primary Google Calendar. Writes immediately — there is no preview step.

WHEN TO USE: user says "schedule…", "book…", "put on my calendar…", "add a meeting…", "crie um evento…", "agenda…" with a specific time.

DO NOT USE for standalone reminder notifications like "me lembre amanhã de beber água" or "remind me at 9". Use reminders.create for those. If the user asks to create a calendar event AND be reminded about it, create the Google Calendar event first, then call reminders.create with the calendar event source metadata.

CONTRACT:
- title, start_iso, end_iso are REQUIRED. Never invent them — if any is missing or vague ("sometime tomorrow"), ASK THE USER before calling.
- end_iso must be after start_iso. Default duration when the user gives only a start time: 1 hour.
- create_meet, participants, location, description are ALL OPTIONAL. **A solo event with just title + time is a perfectly valid event.** Do NOT ask the user for these fields; only include them if the user explicitly mentioned them.
- create_meet=true ONLY if the user mentioned a video call, Meet, or remote meeting.
- participants are full email addresses, NOT names. If the user said "invite Anna":
  1. Call people.search query="Anna" first.
  2. If exactly one match with has_email=true, use that email.
  3. If no match or no email, ASK the user for the email. Never fabricate.
  4. NEVER add invitees the user did NOT explicitly mention. If the user said "create an event for Teste 123 at 11pm" with no names, DO NOT add anyone — create the solo event.
- Side effects: invitees receive a Google Calendar invitation email immediately, irreversible without a follow-up update/delete.

RETURNS receipt: { event_id, html_link, meet_link, status: 'created' }.
- event_id is TECHNICAL — never read it aloud. Keep it in case the user wants to edit/cancel right after.
- html_link and meet_link are user-facing URLs — surface them naturally ("Adicionei na sua agenda" or "I added it to your calendar").

ASK THE USER FIRST IF: time is ambiguous, the user explicitly named someone but you couldn't find their email after people.search, or they said "the usual time" without prior context. **Do NOT** ask about optional fields the user didn't mention.`,
  isReadOnly: false,
  inputSchema: z.object({
    title: z.string().describe('Event title as it will appear on the calendar. Required.'),
    start_iso: z.string().describe('Start in ISO 8601 with timezone offset. Required.'),
    end_iso: z.string().describe('End in ISO 8601. Required. Default to start + 1 hour if the user did not specify duration.'),
    description: z.string().optional().describe('Optional. Only set if the user gave content for it.'),
    location: z.string().optional().describe('Optional. Only set if the user mentioned a place.'),
    create_meet: z.boolean().optional().describe('Optional. Only true if the user mentioned a video call / Meet / remote meeting.'),
    participants: z.array(z.string()).optional().describe('Optional invitee email addresses (NOT names). Only include people the user explicitly mentioned. Resolve names via people.search first. Never fabricate emails. Omit entirely for solo events.'),
    account_nickname: z.string().optional().describe('Linked Google account nickname/name to create the event in. Required when the user has more than one active Google account.'),
  }),
  call: async (args, context) => {
    const resolved = await resolveGoogleAccount(context, args.account_nickname, true);
    if (!resolved.ok) return { ok: false, error: resolved.error };

    const validation = validateAndNormalizeCreateArgs(args, context.timezone || 'UTC');
    if (!validation.ok) return { ok: false, error: validation.error };
    const normalized = validation.normalized;

    try {
      const created = await createCalendarEvent(resolved.account.id, {
        title: normalized.title,
        description: normalized.description,
        location: normalized.location,
        startAt: normalized.startAt,
        endAt: normalized.endAt,
        createMeet: normalized.createMeet,
        participants: normalized.participants,
      }, context);

      return {
        ok: true,
        receipt: {
          event_id: created.id,
          html_link: created.htmlLink,
          meet_link: created.meetLink,
          account_nickname: resolved.account.name,
          status: 'created'
        }
      };
    } catch (e: any) {
      const googleMsg = e?.response?.data?.error?.message || e?.errors?.[0]?.message || e?.message;
      const errCode = e?.response?.data?.error?.code || e?.code;
      const detailedError = errCode && googleMsg ? `Google API ${errCode}: ${googleMsg}` : (googleMsg || 'Failed to create event');
      console.error('[calendar.create_event] Google API error:', { errCode, googleMsg, normalized });
      return { ok: false, error: detailedError };
    }
  }
});

export const calendarUpdateEventTool = defineTool({
  name: 'calendar.update_event',
  description: `Modifies an existing calendar event. Partial update — only the fields you pass are changed.

WHEN TO USE: user says "move my 3pm to 4", "rename the meeting", "add Anna to the team sync", "change the location of…".

CONTRACT:
- event_id is REQUIRED. You MUST call calendar.list_events first to look it up — never invent or guess an ID.
- All other fields are optional. Pass only what changes. Passing nothing else is a no-op (avoid).
- start_iso + end_iso: if you change one, pass both — otherwise duration drifts unintentionally.
- participants REPLACES the full attendee list. To "add Anna", first read the existing event from list_events, then pass the full list including Anna. Otherwise existing invitees get uninvited.
- Side effects: invitees receive an updated invitation email. Reversible only with another update.

RETURNS receipt: { event_id, status: 'updated' }.
- event_id is TECHNICAL — do not show it. Confirm in human terms ("Moved your 3pm to 4pm.").

ASK THE USER FIRST IF: the target event is ambiguous (multiple matches in list_events), or the change is destructive (removing attendees, big time shift). Confirm before executing.`,
  isReadOnly: false,
  inputSchema: z.object({
    event_id: z.string().describe('Google Calendar event ID. Required. Obtain via calendar.list_events — never fabricate.'),
    title: z.string().optional().describe('New title. Omit to keep current.'),
    start_iso: z.string().optional().describe('New start in ISO 8601. If passed, also pass end_iso to preserve duration.'),
    end_iso: z.string().optional().describe('New end in ISO 8601.'),
    description: z.string().optional().describe('New description. Replaces existing body.'),
    location: z.string().optional().describe('New location. Replaces existing.'),
    participants: z.array(z.string()).optional().describe('REPLACES the entire attendee list. Include all existing invitees you want to keep, plus any additions.'),
    account_nickname: z.string().optional().describe('Linked Google account nickname/name containing the event. Required when the user has more than one active Google account.'),
  }),
  call: async (args, context) => {
    const resolved = await resolveGoogleAccount(context, args.account_nickname, true);
    if (!resolved.ok) return { ok: false, error: resolved.error };

    try {
      const updated = await updateCalendarEvent(resolved.account.id, args.event_id, {
        title: args.title,
        description: args.description,
        location: args.location,
        startAt: args.start_iso,
        endAt: args.end_iso,
        participants: args.participants,
      }, context);

      return {
        ok: true,
        receipt: {
          event_id: updated.id,
          account_nickname: resolved.account.name,
          status: 'updated'
        }
      };
    } catch (e: any) {
      const googleMsg = e?.response?.data?.error?.message || e?.errors?.[0]?.message || e?.message;
      const errCode = e?.response?.data?.error?.code || e?.code;
      const detailedError = errCode && googleMsg ? `Google API ${errCode}: ${googleMsg}` : (googleMsg || 'Failed to update event');
      console.error('[calendar.update_event] Google API error:', { errCode, googleMsg, event_id: args.event_id });
      return { ok: false, error: detailedError };
    }
  }
});

export const calendarDeleteEventTool = defineTool({
  name: 'calendar.delete_event',
  description: `Permanently cancels a calendar event. DESTRUCTIVE and irreversible.

WHEN TO USE: user says "cancel my 3pm", "delete the team sync", "remove tomorrow's call". Be conservative.

CONTRACT:
- event_id is REQUIRED. You MUST call calendar.list_events first to locate the event — never guess.
- Side effects: invitees receive a cancellation email immediately. Cannot be undone — a follow-up create_event is a NEW event with a new ID, and any prior thread/notes attached to the old event are lost.
- If list_events returned multiple matches, do NOT pick one silently — ask the user which one.

RETURNS receipt: { event_id, status: 'deleted' }.
- event_id is TECHNICAL — do not echo it. Confirm in human terms ("Cancelled your 3pm with Anna.").

ALWAYS ASK THE USER FIRST IF: the cancellation has invitees, the event is recurring (you may only cancel one instance unintentionally), or the title match wasn't exact. When in doubt, confirm before calling.`,
  isReadOnly: false,
  inputSchema: z.object({
    event_id: z.string().describe('Google Calendar event ID to cancel. Required. Must come from calendar.list_events — never fabricate.'),
    account_nickname: z.string().optional().describe('Linked Google account nickname/name containing the event. Required when the user has more than one active Google account.'),
  }),
  call: async (args, context) => {
    const resolved = await resolveGoogleAccount(context, args.account_nickname, true);
    if (!resolved.ok) return { ok: false, error: resolved.error };

    try {
      await deleteCalendarEvent(resolved.account.id, args.event_id, context);
      return {
        ok: true,
        receipt: {
          event_id: args.event_id,
          account_nickname: resolved.account.name,
          status: 'deleted'
        }
      };
    } catch (e: any) {
      const googleMsg = e?.response?.data?.error?.message || e?.errors?.[0]?.message || e?.message;
      const errCode = e?.response?.data?.error?.code || e?.code;
      const detailedError = errCode && googleMsg ? `Google API ${errCode}: ${googleMsg}` : (googleMsg || 'Failed to delete event');
      console.error('[calendar.delete_event] Google API error:', { errCode, googleMsg, event_id: args.event_id });
      return { ok: false, error: detailedError };
    }
  }
});

export const calendarDeleteEventsBatchTool = defineTool({
  name: 'calendar.delete_events_batch',
  description: `Cancels MULTIPLE calendar events in one call. DESTRUCTIVE and irreversible.

WHEN TO USE: user says "delete all events tomorrow", "cancel everything in my calendar this week", "apaga esses eventos aqui" (with multiple events visible), or after listing events the user wants to clear in bulk. Saves N round-trips and avoids the model getting stuck on the first one.

CONTRACT:
- event_ids is REQUIRED — array of Google Calendar event IDs from a prior calendar.list_events call. Never invent IDs.
- Deletions run in parallel; failures are reported per-id without aborting the whole batch.
- Each deleted event sends a cancellation email to its invitees.
- If the user has not explicitly confirmed bulk deletion, ASK FIRST. This is destructive — show the count and a brief description ("found 3 events tomorrow: X at 10am, Y at 2pm, Z at 5pm — cancel all?") and wait for confirmation before calling.

RETURNS receipt: { deleted_count, failed_count, results[], summary }. Each result: { event_id, status: 'deleted' | 'failed', error? }.
- event_ids are TECHNICAL — never echo. Confirm in human terms.
- **summary** is the source of truth for what happened. ALWAYS read summary AND failed_count before composing the user reply. NEVER claim "I deleted all of them" if failed_count > 0 — say exactly what the receipt reports.

CRITICAL — verify before you claim:
- If deleted_count === requested_count → "Deleted N events."
- If 0 < deleted_count < requested_count → "Deleted X of N. Y failed: <reason from results>."
- If deleted_count === 0 → "Couldn't delete: <reasons from results>."
- If you ignore failed_count and tell the user "deleted all" when some failed, you have lied to the user. Don't.

ALWAYS ASK FIRST IF: more than 1 event, recurring events involved, or the user's request was ambiguous about which events to delete.`,
  isReadOnly: false,
  inputSchema: z.object({
    event_ids: z.array(z.string()).describe('Array of Google Calendar event IDs to cancel. Required. Must come from calendar.list_events — never fabricate.'),
    account_nickname: z.string().optional().describe('Linked Google account nickname/name containing these events. Required when the user has more than one active Google account.'),
  }),
  call: async (args, context) => {
    const resolved = await resolveGoogleAccount(context, args.account_nickname, true);
    if (!resolved.ok) return { ok: false, error: resolved.error };

    if (!Array.isArray(args.event_ids) || args.event_ids.length === 0) {
      return { ok: false, error: 'event_ids must be a non-empty array' };
    }
    if (args.event_ids.length > 50) {
      return { ok: false, error: `event_ids exceeds the safety cap of 50 (got ${args.event_ids.length}). Confirm with the user before deleting this many — split the operation if needed.` };
    }

    const results = await Promise.all(
      args.event_ids.map(async (event_id) => {
        try {
          await deleteCalendarEvent(resolved.account.id, event_id, context);
          return { event_id, status: 'deleted' as const };
        } catch (e: any) {
          const googleMsg = e?.response?.data?.error?.message || e?.errors?.[0]?.message || e?.message;
          const errCode = e?.response?.data?.error?.code || e?.code;
          const detailedError = errCode && googleMsg ? `Google API ${errCode}: ${googleMsg}` : (googleMsg || 'Failed to delete event');
          console.error('[calendar.delete_events_batch] one event failed:', { event_id, errCode, googleMsg });
          return { event_id, status: 'failed' as const, error: detailedError };
        }
      })
    );

    const deleted_count = results.filter(r => r.status === 'deleted').length;
    const failed_count = results.length - deleted_count;
    const requested_count = args.event_ids.length;

    let summary: string;
    if (failed_count === 0) {
      summary = `All ${deleted_count} requested events were deleted successfully.`;
    } else if (deleted_count === 0) {
      const reasons = results.filter(r => r.status === 'failed').map(r => r.error).slice(0, 3).join('; ');
      summary = `NONE of the ${requested_count} events were deleted. All failed. Reasons: ${reasons}`;
    } else {
      const reasons = results.filter(r => r.status === 'failed').map(r => r.error).slice(0, 3).join('; ');
      summary = `PARTIAL FAILURE: ${deleted_count} of ${requested_count} deleted, ${failed_count} failed. Failure reasons: ${reasons}. DO NOT tell the user "all deleted" — be specific about which failed.`;
    }

    return {
      ok: true,
      receipt: {
        deleted_count,
        failed_count,
        requested_count,
        account_nickname: resolved.account.name,
        summary,
        results,
      },
    };
  },
});
