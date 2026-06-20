const mockGetUserEntitlements = jest.fn();
const mockIsFeatureAllowed = jest.fn();

jest.mock('@/lib/billing/entitlements', () => ({
  getUserEntitlements: (...args: unknown[]) => mockGetUserEntitlements(...args),
  isFeatureAllowed: (...args: unknown[]) => mockIsFeatureAllowed(...args),
}));

import { resolveReminderProvider, providerLabel } from '@/lib/reminders/providers';
import { createReminder, normalizeScheduledFor, sendDueReminders, validateReminderInput } from '@/lib/reminders/reminders';
import { sendText } from '@/lib/whatsapp/evolution-client';

jest.mock('@/lib/whatsapp/evolution-client', () => ({
  sendText: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserEntitlements.mockResolvedValue({ features: { reminders: true } });
  mockIsFeatureAllowed.mockReturnValue(true);
});

function makeSelectChain<T>(data: T[]) {
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data, error: null }).then(resolve as any, reject as any);
    },
  };
  ['select', 'eq', 'gte', 'lte', 'order', 'limit'].forEach(method => {
    chain[method] = jest.fn().mockReturnValue(chain);
  });
  return chain;
}

function makeMaybeChain<T>(data: T | null) {
  const chain: any = {};
  ['select', 'eq'].forEach(method => {
    chain[method] = jest.fn().mockReturnValue(chain);
  });
  chain.maybeSingle = jest.fn().mockResolvedValue({ data, error: null });
  return chain;
}

function makeInsertChain<T>(data: T) {
  const chain: any = {};
  ['insert', 'select'].forEach(method => {
    chain[method] = jest.fn().mockReturnValue(chain);
  });
  chain.single = jest.fn().mockResolvedValue({ data, error: null });
  return chain;
}

function makeUpdateChain() {
  const chain: any = {
    then(resolve: Function, reject: Function) {
      return Promise.resolve({ data: [], error: null }).then(resolve as any, reject as any);
    },
  };
  ['update', 'eq', 'select'].forEach(method => {
    chain[method] = jest.fn().mockReturnValue(chain);
  });
  chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
  return chain;
}

describe('reminder provider mapping', () => {
  it('keeps ManyChat internal behind the Instagram channel', () => {
    expect(resolveReminderProvider('default')).toBe('whatsapp');
    expect(resolveReminderProvider('whatsapp')).toBe('whatsapp');
    expect(resolveReminderProvider('instagram')).toBe('manychat');
    expect(providerLabel('manychat')).toBe('Instagram');
  });
});

describe('validateReminderInput', () => {
  it('rejects invalid reminder payloads', () => {
    expect(validateReminderInput({ message: '', scheduled_for: '2026-05-20T10:00:00Z' })).toBe('message is required');
    expect(validateReminderInput({ message: 'Oi', scheduled_for: 'not-a-date' })).toBe('scheduled_for must be a valid ISO datetime');
  });
});

describe('normalizeScheduledFor', () => {
  it('reinterprets a Z-suffixed wall-clock as local time in a non-UTC timezone', () => {
    expect(normalizeScheduledFor('2026-05-25T10:00:00Z', 'America/Sao_Paulo')).toBe('2026-05-25T13:00:00.000Z');
  });

  it('leaves explicit offsets untouched', () => {
    expect(normalizeScheduledFor('2026-05-25T10:00:00-03:00', 'America/Sao_Paulo')).toBe('2026-05-25T13:00:00.000Z');
  });

  it('keeps UTC as UTC when timezone is UTC', () => {
    expect(normalizeScheduledFor('2026-05-25T10:00:00Z', 'UTC')).toBe('2026-05-25T10:00:00.000Z');
  });
});

describe('createReminder', () => {
  it('persists standalone reminders', async () => {
    const reminder = {
      id: 'rem-1',
      user_id: 'user-1',
      title: null,
      message: 'Me lembrar',
      scheduled_for: '2026-05-20T10:00:00.000Z',
      timezone: 'America/Sao_Paulo',
      status: 'scheduled',
      channel_preference: 'whatsapp',
      source_type: null,
      source_provider: null,
      source_id: null,
      source_title: null,
      source_start_at: null,
      created_by: 'balys',
      dedupe_key: null,
    };
    const insertChain = makeInsertChain(reminder);
    const supabase = { from: jest.fn().mockReturnValue(insertChain) };

    const result = await createReminder(supabase, 'user-1', {
      message: 'Me lembrar',
      scheduled_for: '2026-05-20T10:00:00Z',
      timezone: 'America/Sao_Paulo',
      channel_preference: 'whatsapp',
    });

    expect(result.id).toBe('rem-1');
    expect(insertChain.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      message: 'Me lembrar',
      channel_preference: 'whatsapp',
    }));
  });
});

describe('sendDueReminders', () => {
  it('skips delivery for Free users', async () => {
    mockIsFeatureAllowed.mockReturnValue(false);
    const dueReminder = {
      id: 'rem-free', user_id: 'user-free', message: 'Hora do foco', scheduled_for: '2026-05-20T10:00:00.000Z',
      channel_preference: 'whatsapp', status: 'scheduled',
    };
    const remindersChain = makeSelectChain([dueReminder]);
    const supabase = { from: jest.fn().mockReturnValue(remindersChain) };

    const result = await sendDueReminders(supabase, '2026-05-20T10:05:00.000Z');

    expect(result).toEqual({ inspected: 1, sent: 0, failed: 0, skipped: 1 });
    expect(sendText).not.toHaveBeenCalled();
  });

  it('sends due WhatsApp reminders and marks them sent', async () => {
    const dueReminder = {
      id: 'rem-1',
      user_id: 'user-1',
      title: null,
      message: 'Hora do foco',
      scheduled_for: '2026-05-20T10:00:00.000Z',
      timezone: 'UTC',
      status: 'scheduled',
      channel_preference: 'whatsapp',
      source_type: null,
      source_provider: null,
      source_id: null,
      source_title: null,
      source_start_at: null,
      created_by: 'balys',
      dedupe_key: null,
    };
    const chains = {
      reminders: [makeSelectChain([dueReminder]), makeUpdateChain()],
      reminder_deliveries: [makeMaybeChain(null), makeInsertChain({ id: 'del-1', status: 'pending' }), makeUpdateChain()],
      whatsapp_channels: [makeMaybeChain({ phone: '5511999999999', status: 'active', reminders_enabled: true })],
    };
    const supabase = {
      from: jest.fn((table: keyof typeof chains) => chains[table].shift()),
    };

    const result = await sendDueReminders(supabase, '2026-05-20T10:05:00.000Z');

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(sendText).toHaveBeenCalledWith('5511999999999', 'Hora do foco');
  });

  it('marks a reminder failed when no WhatsApp reminder channel is active', async () => {
    const dueReminder = {
      id: 'rem-1',
      user_id: 'user-1',
      title: null,
      message: 'Hora do foco',
      scheduled_for: '2026-05-20T10:00:00.000Z',
      timezone: 'UTC',
      status: 'scheduled',
      channel_preference: 'whatsapp',
      source_type: null,
      source_provider: null,
      source_id: null,
      source_title: null,
      source_start_at: null,
      created_by: 'balys',
      dedupe_key: null,
    };
    const chains = {
      reminders: [makeSelectChain([dueReminder]), makeUpdateChain()],
      reminder_deliveries: [makeMaybeChain(null), makeInsertChain({ id: 'del-1', status: 'pending' }), makeUpdateChain()],
      whatsapp_channels: [makeMaybeChain(null)],
    };
    const supabase = {
      from: jest.fn((table: keyof typeof chains) => chains[table].shift()),
    };

    const result = await sendDueReminders(supabase, '2026-05-20T10:05:00.000Z');

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
  });

  it('does not send duplicate provider messages when a sent delivery already exists', async () => {
    const dueReminder = {
      id: 'rem-1',
      user_id: 'user-1',
      title: null,
      message: 'Hora do foco',
      scheduled_for: '2026-05-20T10:00:00.000Z',
      timezone: 'UTC',
      status: 'scheduled',
      channel_preference: 'whatsapp',
      source_type: null,
      source_provider: null,
      source_id: null,
      source_title: null,
      source_start_at: null,
      created_by: 'balys',
      dedupe_key: null,
    };
    const chains = {
      reminders: [makeSelectChain([dueReminder]), makeUpdateChain()],
      reminder_deliveries: [makeMaybeChain({ id: 'del-1', status: 'sent' })],
      whatsapp_channels: [],
    };
    const supabase = {
      from: jest.fn((table: keyof typeof chains) => chains[table].shift()),
    };

    const result = await sendDueReminders(supabase, '2026-05-20T10:05:00.000Z');

    expect(result.skipped).toBe(1);
    expect(sendText).not.toHaveBeenCalled();
  });
});
