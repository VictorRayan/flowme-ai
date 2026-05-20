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
  description: `Creates a reminder notification for the user. Reminders are notifications only: they are NOT tasks, NOT microactivities, and NOT calendar events.

WHEN TO USE: user says "me lembre...", "remind me...", "avise-me...", or asks for a reminder attached to a calendar event.

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

