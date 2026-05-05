import { z } from 'zod';
import { defineTool, ToolContext } from './Tool';

function normalizeIso(iso: string, fallbackTimezone: string): string | null {
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
      }).formatToParts(probe).find((part) => part.type === 'timeZoneName')?.value || '';
      const match = formatted.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
      if (match) {
        const signMultiplier = match[1] === '-' ? -1 : 1;
        return signMultiplier * (parseInt(match[2], 10) * 60 + parseInt(match[3] || '0', 10));
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

export const eventsListTool = defineTool({
  name: 'events.list',
  description: `Lists the user's Flowme events. These are Flowme-native executable commitments that live in Flowme and appear alongside Google Calendar events.

WHEN TO USE:
- User asks what is on their Flowme calendar, Today path, goals execution plan, or local events.
- Before events.delete to look up internal event IDs.
- As a complement to calendar.list_events when the user says "delete all events" and may mean both Google and Flowme events.

CONTRACT:
- start_iso / end_iso bound the search window. If omitted, defaults to today + 14 days.
- Read-only.
- IDs are technical. Never echo them to the user.`,
  isReadOnly: true,
  inputSchema: z.object({
    start_iso: z.string().optional().describe('Inclusive start of window. Defaults to today.'),
    end_iso: z.string().optional().describe('Exclusive end of window. Defaults to start_iso + 14 days.'),
  }),
  call: async (args, context: ToolContext) => {
    try {
      const tz = context.timezone || 'UTC';
      const start = args.start_iso ? normalizeIso(args.start_iso, tz) : new Date(context.nowIso).toISOString();
      if (!start) return { ok: false, error: 'start_iso invalid' };
      let end = args.end_iso ? normalizeIso(args.end_iso, tz) : null;
      if (!end) {
        const d = new Date(start);
        d.setUTCDate(d.getUTCDate() + 14);
        end = d.toISOString();
      }

      const { data, error } = await context.supabase
        .from('microactivities')
        .select('id, title, description, start_at, end_at, scheduled_date, duration_minutes, source_type, outcome, is_time_blocked')
        .eq('user_id', context.user.id)
        .gte('start_at', start)
        .lt('start_at', end)
        .order('start_at', { ascending: true });

      if (error) throw error;

      return {
        ok: true,
        receipt: {
          events: data || [],
          count: (data || []).length,
          window: { start, end },
        },
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Failed to list events' };
    }
  },
});

export const eventsDeleteTool = defineTool({
  name: 'events.delete',
  description: `Deletes one or more Flowme events. DESTRUCTIVE.

WHEN TO USE: user wants to remove Flowme events. Pair with events.list to get the IDs first.

CONTRACT:
- ids is REQUIRED and must come from events.list.
- Confirm with the user before deleting more than one.
- Read the summary before composing the final reply.`,
  isReadOnly: false,
  inputSchema: z.object({
    ids: z.array(z.string()).describe('Array of Flowme event IDs to delete. Required. Must come from events.list.'),
  }),
  call: async (args, context: ToolContext) => {
    try {
      if (!Array.isArray(args.ids) || args.ids.length === 0) {
        return { ok: false, error: 'ids must be a non-empty array' };
      }
      if (args.ids.length > 50) {
        return { ok: false, error: `ids exceeds the safety cap of 50 (got ${args.ids.length}).` };
      }

      const { data, error } = await context.supabase
        .from('microactivities')
        .delete()
        .eq('user_id', context.user.id)
        .in('id', args.ids)
        .select('id');

      if (error) throw error;

      const deletedCount = (data || []).length;
      const requestedCount = args.ids.length;
      const summary = deletedCount === requestedCount
        ? `All ${deletedCount} Flowme events deleted.`
        : deletedCount === 0
          ? `NONE of the ${requestedCount} Flowme events were deleted.`
          : `PARTIAL: ${deletedCount} of ${requestedCount} Flowme events deleted.`;

      return {
        ok: true,
        receipt: {
          deleted_count: deletedCount,
          requested_count: requestedCount,
          summary,
        },
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Failed to delete events' };
    }
  },
});

export const eventsCreateTool = defineTool({
  name: 'events.create',
  description: `Creates a Flowme event: an executable commitment that lives in Flowme and appears in Today and Calendar.

WHEN TO USE: user wants a personal task/event/reminder that does not need Google Calendar invites or Google sync. For meetings with invitees or Google Meet, use calendar.create_event.

CONTRACT:
- title is required.
- start_iso or scheduled_date is required.
- end_iso is optional. If omitted, the event is flexible on that day.`,
  isReadOnly: false,
  inputSchema: z.object({
    title: z.string().describe('Title. Required, non-empty.'),
    start_iso: z.string().optional().describe('Start in ISO 8601. Optional when scheduled_date is provided.'),
    end_iso: z.string().optional().describe('End in ISO 8601. Optional.'),
    scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Day for flexible events.'),
    duration_minutes: z.number().min(1).max(240).optional().describe('Estimated duration.'),
    description: z.string().optional().describe('Optional notes.'),
  }),
  call: async (args, context: ToolContext) => {
    try {
      const tz = context.timezone || 'UTC';
      const title = (args.title || '').trim();
      if (!title) return { ok: false, error: 'title is required' };
      const start = args.start_iso ? normalizeIso(args.start_iso, tz) : null;
      const end = args.end_iso ? normalizeIso(args.end_iso, tz) : null;
      const scheduledDate = args.scheduled_date || start?.slice(0, 10);
      if (!scheduledDate) return { ok: false, error: 'start_iso or scheduled_date is required' };
      const startAt = start || `${scheduledDate}T09:00:00.000Z`;

      const { data, error } = await context.supabase
        .from('microactivities')
        .insert({
          user_id: context.user.id,
          title,
          description: args.description || null,
          scheduled_date: scheduledDate,
          start_at: startAt,
          end_at: end,
          duration_minutes: args.duration_minutes || null,
          source_type: 'manual',
          outcome: 'pending',
          is_time_blocked: Boolean(start && end),
        })
        .select('id, title')
        .single();

      if (error) throw error;

      return {
        ok: true,
        receipt: {
          id: data.id,
          title: data.title,
          status: 'created',
        },
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Failed to create event' };
    }
  },
});
