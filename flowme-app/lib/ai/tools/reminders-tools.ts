import { z } from 'zod';
import { defineTool } from './Tool';
import { cancelReminder, createReminder, listReminders } from '@/lib/reminders/reminders';

const channelSchema = z.enum(['default', 'whatsapp', 'instagram', 'push']);

const sourceSchema = z.object({
  type: z.literal('calendar_event'),
  provider: z.literal('google_calendar'),
  id: z.string().min(1),
  title: z.string().optional(),
  start_at: z.string().optional(),
});

export const remindersCreateTool = defineTool({
  name: 'reminders.create',
  description: `Creates a reminder notification for the user. Reminders are notifications only: they are NOT tasks and NOT calendar events.

WHEN TO USE: user says "me lembre...", "remind me...", "avise-me...", or asks for a reminder attached to a calendar event.

REQUIRED INFORMATION — NEVER CALL THIS TOOL UNTIL YOU HAVE ALL OF IT:
- **message**: a short, clear notification body (e.g. "Escovar os dentes"). Infer it from the user's request when obvious ("me lembre de escovar os dentes" → "Escovar os dentes"). If you cannot infer it confidently, ASK the user before calling this tool.
- **scheduled_for**: a full ISO 8601 datetime carrying the user's timezone offset, NOT \`Z\`/UTC. You MUST resolve relative phrases ("amanhã", "tomorrow", "next Monday", "daqui 2 horas") using the "Current local date/time" in your system prompt, in the user's timezone. If only the date is given but no time of day, ASK the user what time (e.g. "Que horas amanhã?"). NEVER guess a default time.
  - Correct: \`"2026-05-25T10:00:00-03:00"\` when the user said "amanhã às 10 da manhã" in São Paulo.
  - WRONG: \`"2026-05-25T10:00:00Z"\` — that fires at 7 AM in São Paulo, not 10 AM.
- **timezone**: pass the IANA timezone you used to resolve scheduled_for (e.g. "America/Sao_Paulo"). When unsure, use the timezone provided in the system prompt's "Current local date/time" line. Always pair this with a matching offset in scheduled_for.

DO NOT call this tool with placeholder, empty, or undefined values. If anything is missing, ask the user one short clarifying question and stop.

CONTRACT:
- For an event reminder, create or find the Google Calendar event first, then call this tool with source.type="calendar_event", source.provider="google_calendar", source.id=calendar event_id, source.title, and source.start_at.
- For standalone reminders, omit source.
- channel_preference is customer-facing. Use "whatsapp" or "default" unless the user explicitly asks for Instagram or Push.
- Never mention provider internals such as ManyChat to the user.
- If the tool fails because no reminder channel is active, ask the user to activate a reminder channel.

RETURNS receipt: { reminder_id, scheduled_for, channel_preference, status }. reminder_id is technical; never show it to the user.`,
  isReadOnly: false,
  inputSchema: z.object({
    title: z.string().optional(),
    message: z.string().min(1).max(1000).describe('Notification message to send to the user.'),
    scheduled_for: z.string().describe('Reminder send time as ISO 8601 datetime.'),
    timezone: z.string().optional(),
    channel_preference: channelSchema.optional().default('default'),
    source: sourceSchema.optional(),
    dedupe_key: z.string().optional(),
  }),
  call: async (args, context) => {
    try {
      const reminder = await createReminder(context.supabase, context.user.id, {
        title: args.title,
        message: args.message,
        scheduled_for: args.scheduled_for,
        timezone: args.timezone || context.timezone || 'UTC',
        channel_preference: args.channel_preference,
        source: args.source || null,
        created_by: 'balys',
        dedupe_key: args.dedupe_key || null,
      });

      return {
        ok: true,
        receipt: {
          reminder_id: reminder.id,
          scheduled_for: reminder.scheduled_for,
          channel_preference: reminder.channel_preference,
          status: reminder.status,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create reminder';
      return { ok: false, error: message };
    }
  },
});

export const remindersListTool = defineTool({
  name: 'reminders.list',
  description: `Reads the user's reminders. Use before cancelling or when the user asks what reminders are scheduled. Never expose technical IDs.`,
  isReadOnly: true,
  inputSchema: z.object({
    status: z.enum(['scheduled', 'sent', 'cancelled', 'failed']).optional().default('scheduled'),
    source_type: z.literal('calendar_event').optional(),
    source_id: z.string().optional(),
    start_iso: z.string().optional(),
    end_iso: z.string().optional(),
    limit: z.number().optional().default(20),
  }),
  call: async (args, context) => {
    try {
      const reminders = await listReminders(context.supabase, context.user.id, args);
      return {
        ok: true,
        receipt: {
          reminders: reminders.map((reminder) => ({
            id: reminder.id,
            message: reminder.message,
            scheduled_for: reminder.scheduled_for,
            status: reminder.status,
            channel_preference: reminder.channel_preference,
            source_title: reminder.source_title,
          })),
          count: reminders.length,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to list reminders';
      return { ok: false, error: message };
    }
  },
});

export const remindersCancelTool = defineTool({
  name: 'reminders.cancel',
  description: `Cancels a scheduled reminder. First resolve the reminder through reminders.list; never ask the user for a technical ID.`,
  isReadOnly: false,
  inputSchema: z.object({
    reminder_id: z.string().min(1).describe('Technical reminder ID from reminders.list. Never ask the user for this.'),
  }),
  call: async (args, context) => {
    try {
      await cancelReminder(context.supabase, context.user.id, args.reminder_id);
      return { ok: true, receipt: { reminder_id: args.reminder_id, status: 'cancelled' } };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to cancel reminder';
      return { ok: false, error: message };
    }
  },
});
