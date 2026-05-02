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

export const microactivitiesListTool = defineTool({
  name: 'microactivities.list',
  description: `Lists the user's Flowme microactivities (lightweight calendar entries that live in Flowme, NOT in Google Calendar). They appear alongside Google events in the Flowme calendar UI as "Untitled Event" or with a custom title.

WHEN TO USE:
- User asks "what's on my Flowme calendar" or asks about events you don't find via calendar.list_events but should be there.
- Before microactivities.delete to look up IDs.
- As a complement to calendar.list_events when user says "delete all events" — microactivities show up in the same UI, so usually they want both gone.

CONTRACT:
- start_iso / end_iso bound the search window. If omitted, defaults to today + 14 days.
- Read-only.

RETURNS receipt: { microactivities[], count }. Each: { id, title, description, start_at, end_at }.
- id is TECHNICAL — never echo. Use only to chain into microactivities.delete.`,
  isReadOnly: true,
  inputSchema: z.object({
    start_iso: z.string().optional().describe('Inclusive start of window. Defaults to today.'),
    end_iso: z.string().optional().describe('Exclusive end of window. Defaults to start_iso + 14 days.'),
  }),
  call: async (args, context) => {
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
        .select('id, title, description, start_at, end_at')
        .eq('user_id', context.user.id)
        .gte('start_at', start)
        .lt('start_at', end)
        .order('start_at', { ascending: true });

      if (error) throw error;

      return {
        ok: true,
        receipt: {
          microactivities: data || [],
          count: (data || []).length,
          window: { start, end },
        },
      };
    } catch (e: any) {
      return { ok: false, error: e.message || 'Failed to list microactivities' };
    }
  },
});

export const microactivitiesDeleteTool = defineTool({
  name: 'microactivities.delete',
  description: `Deletes ONE OR MORE Flowme microactivities. DESTRUCTIVE.

WHEN TO USE: user wants to remove microactivities (often described just as "events"). Pair with microactivities.list to get the IDs first.

CONTRACT:
- ids is REQUIRED — array of microactivity IDs from microactivities.list. Never invent.
- Confirm with the user before deleting more than one.

RETURNS receipt: { deleted_count, requested_count, summary }.
- summary is the source of truth. Read it before composing the user reply.`,
  isReadOnly: false,
  inputSchema: z.object({
    ids: z.array(z.string()).describe('Array of microactivity IDs to delete. Required. Must come from microactivities.list.'),
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

      const deleted_count = (data || []).length;
      const requested_count = args.ids.length;
      const summary = deleted_count === requested_count
        ? `All ${deleted_count} microactivities deleted.`
        : deleted_count === 0
          ? `NONE of the ${requested_count} microactivities were deleted (IDs may not exist or belong to another user).`
          : `PARTIAL: ${deleted_count} of ${requested_count} deleted. The rest were not found.`;

      return {
        ok: true,
        receipt: {
          deleted_count,
          requested_count,
          summary,
        },
      };
    } catch (e: any) {
      return { ok: false, error: e.message || 'Failed to delete microactivities' };
    }
  },
});

export const microactivitiesCreateTool = defineTool({
  name: 'microactivities.create',
  description: `Creates a Flowme microactivity (a lightweight calendar entry that lives in Flowme, NOT Google Calendar).

WHEN TO USE: user wants a quick reminder/task on their Flowme calendar that does NOT need to sync to Google or invite anyone. For "schedule a meeting" or "create an event for Anna at 3pm" use calendar.create_event instead — those need Google's invite mechanics.

CONTRACT:
- title, start_iso are REQUIRED.
- end_iso is optional — Flowme treats microactivities as time points if omitted.

RETURNS receipt: { id, title, status: 'created' }.`,
  isReadOnly: false,
  inputSchema: z.object({
    title: z.string().describe('Title. Required, non-empty.'),
    start_iso: z.string().describe('Start in ISO 8601. Required.'),
    end_iso: z.string().optional().describe('End in ISO 8601. Optional.'),
    description: z.string().optional().describe('Optional notes.'),
  }),
  call: async (args, context: ToolContext) => {
    try {
      const tz = context.timezone || 'UTC';
      const title = (args.title || '').trim();
      if (!title) return { ok: false, error: 'title is required' };
      const start = normalizeIso(args.start_iso, tz);
      if (!start) return { ok: false, error: 'start_iso invalid' };
      const end = args.end_iso ? normalizeIso(args.end_iso, tz) : null;

      const { data, error } = await context.supabase
        .from('microactivities')
        .insert({
          user_id: context.user.id,
          title,
          description: args.description || null,
          start_at: start,
          end_at: end,
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
    } catch (e: any) {
      return { ok: false, error: e.message || 'Failed to create microactivity' };
    }
  },
});
