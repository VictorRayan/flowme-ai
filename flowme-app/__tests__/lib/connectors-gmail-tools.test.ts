const mockRequireFeature = jest.fn();

jest.mock('@/lib/billing/entitlements', () => {
  class FeatureLockedError extends Error {
    feature: string;
    required_plan = 'pro';

    constructor(feature: string) {
      super('Feature requires Flow Me Pro');
      this.name = 'FeatureLockedError';
      this.feature = feature;
    }
  }

  return {
    FeatureLockedError,
    requireFeature: (...args: unknown[]) => mockRequireFeature(...args),
  };
});

jest.mock('@/lib/google/google-gmail', () => ({
  searchEmails: jest.fn().mockResolvedValue([{ id: 'm1', threadId: 't1', snippet: 'hello', subject: 'Subject', from: 'a@example.com', date: 'today' }]),
  readEmailMessage: jest.fn().mockResolvedValue({
    id: 'm1',
    threadId: 't1',
    snippet: 'hello',
    subject: 'Subject',
    from: 'a@example.com',
    to: 'victor@example.com',
    date: 'today',
    body_text: 'Full body',
    attachments: [],
  }),
  createDraft: jest.fn().mockResolvedValue({ id: 'draft-1', messageId: 'message-1' }),
}));
jest.mock('@/lib/ai/outbound-idempotency', () => ({
  runOutboundOnce: jest.fn((_context, _provider, _payload, send) => send()),
}));

import { gmailCreateDraftTool, gmailReadMessageTool, gmailSearchMessagesTool } from '@/lib/ai/tools/connectors-tools';
import { createDraft, readEmailMessage, searchEmails } from '@/lib/google/google-gmail';

function makeContext() {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { config: { linked_account_id: 'linked-account-1' } }, error: null }),
  };
  const supabase = { from: jest.fn().mockReturnValue(chain) };
  return {
    supabase,
    user: { id: 'user-1', email: 'victor@example.com' },
    timezone: 'America/Sao_Paulo',
    nowIso: '2026-05-06T22:10:00.000Z',
  } as any;
}

describe('gmail connector tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireFeature.mockResolvedValue({ features: { connectors: true } });
  });

  it('passes tool context to Gmail search for WhatsApp/backend auth flows', async () => {
    const context = makeContext();

    const result = await gmailSearchMessagesTool.call({ query: 'from:test@example.com', max_results: 3 }, context);

    expect(result.ok).toBe(true);
    expect(searchEmails).toHaveBeenCalledWith('linked-account-1', 'from:test@example.com', 3, context);
  });

  it('passes tool context to Gmail draft creation for WhatsApp/backend auth flows', async () => {
    const context = makeContext();

    const result = await gmailCreateDraftTool.call({
      to: ['test@example.com'],
      subject: 'Subject',
      body: 'Body',
    }, context);

    expect(result.ok).toBe(true);
    expect(createDraft).toHaveBeenCalledWith('linked-account-1', ['test@example.com'], 'Subject', 'Body', context);
  });

  it('passes tool context to Gmail body reads for WhatsApp/backend auth flows', async () => {
    const context = makeContext();

    const result = await gmailReadMessageTool.call({ message_id: 'm1' }, context);

    expect(result.ok).toBe(true);
    expect(readEmailMessage).toHaveBeenCalledWith('linked-account-1', 'm1', context);
  });

  it('resolves and reads a Gmail follow-up by natural sender and subject', async () => {
    const context = makeContext();
    (searchEmails as jest.Mock).mockResolvedValueOnce([
      {
        id: 'm-pedro',
        threadId: 't-pedro',
        snippet: 'Aula tres comecou',
        subject: '🔴 [AULA 3] COMEÇOU!',
        from: 'Pedro Sobral <pedro@example.com>',
        date: 'Wed, 20 May 2026 10:00:00 -0300',
      },
      {
        id: 'm-other',
        threadId: 't-other',
        snippet: 'Other',
        subject: 'Other subject',
        from: 'Other <other@example.com>',
        date: 'Wed, 20 May 2026 11:00:00 -0300',
      },
    ]);

    const result = await gmailReadMessageTool.call({
      sender: 'Pedro Sobral',
      subject: 'AULA 3 COMEÇOU',
    }, context);

    expect(result.ok).toBe(true);
    expect(searchEmails).toHaveBeenCalledWith(
      'linked-account-1',
      expect.stringContaining('Pedro Sobral'),
      10,
      context,
    );
    expect(searchEmails).toHaveBeenCalledWith(
      'linked-account-1',
      expect.stringContaining('subject:'),
      10,
      context,
    );
    expect(readEmailMessage).toHaveBeenCalledWith('linked-account-1', 'm-pedro', context);
  });

  it('asks for human-facing disambiguation when sender-only Gmail follow-up matches multiple messages', async () => {
    const context = makeContext();
    (searchEmails as jest.Mock).mockResolvedValueOnce([
      {
        id: 'm-pedro-1',
        threadId: 't-pedro-1',
        snippet: 'Aula tres comecou',
        subject: '🔴 [AULA 3] COMEÇOU!',
        from: 'Pedro Sobral <pedro@example.com>',
        date: 'Wed, 20 May 2026 10:00:00 -0300',
      },
      {
        id: 'm-pedro-2',
        threadId: 't-pedro-2',
        snippet: 'Falta uma hora',
        subject: '⏰ FALTA 1H: Google Ads que Funciona',
        from: 'Pedro Sobral <pedro@example.com>',
        date: 'Wed, 20 May 2026 09:00:00 -0300',
      },
    ]);

    const result = await gmailReadMessageTool.call({ sender: 'Pedro Sobral' }, context);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Multiple emails match');
    expect(readEmailMessage).not.toHaveBeenCalled();
  });
});
