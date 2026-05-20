import { getActiveToolDomains, getToolByName } from '@/lib/ai/tools/registry';
import { remindersCreateTool } from '@/lib/ai/tools/reminders-tools';
import { createReminder } from '@/lib/reminders/reminders';

jest.mock('@/lib/reminders/reminders', () => ({
  createReminder: jest.fn().mockResolvedValue({
    id: 'rem-1',
    scheduled_for: '2026-05-20T10:00:00Z',
    channel_preference: 'whatsapp',
    status: 'scheduled',
  }),
  listReminders: jest.fn().mockResolvedValue([]),
  cancelReminder: jest.fn().mockResolvedValue(undefined),
}));

describe('reminders Balys tools', () => {
  it('registers the reminders domain', () => {
    expect(getToolByName('reminders.create')).toBeDefined();
    expect(getToolByName('reminders.list')).toBeDefined();
    expect(getToolByName('reminders.cancel')).toBeDefined();
    expect(getActiveToolDomains()).toContain('reminders');
  });

  it('creates standalone reminders', async () => {
    const result = await remindersCreateTool.call({
      message: 'Me lembre de respirar',
      scheduled_for: '2026-05-20T10:00:00Z',
      channel_preference: 'whatsapp',
    }, {
      supabase: {},
      user: { id: 'user-1' },
      timezone: 'America/Sao_Paulo',
      nowIso: '2026-05-19T10:00:00Z',
    });

    expect(result.ok).toBe(true);
    expect(createReminder).toHaveBeenCalledWith({}, 'user-1', expect.objectContaining({
      message: 'Me lembre de respirar',
      channel_preference: 'whatsapp',
      created_by: 'balys',
    }));
  });

  it('creates event-attached reminders', async () => {
    await remindersCreateTool.call({
      message: 'Entrar na call',
      scheduled_for: '2026-05-20T09:50:00Z',
      source: {
        type: 'calendar_event',
        provider: 'google_calendar',
        id: 'google-event-1',
        title: 'Call',
        start_at: '2026-05-20T10:00:00Z',
      },
    }, {
      supabase: {},
      user: { id: 'user-1' },
      timezone: 'America/Sao_Paulo',
      nowIso: '2026-05-19T10:00:00Z',
    });

    expect(createReminder).toHaveBeenCalledWith({}, 'user-1', expect.objectContaining({
      source: expect.objectContaining({ id: 'google-event-1', provider: 'google_calendar' }),
    }));
  });
});

