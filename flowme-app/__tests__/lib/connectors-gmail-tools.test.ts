jest.mock('@/lib/google/google-gmail', () => ({
  searchEmails: jest.fn().mockResolvedValue([{ id: 'm1', threadId: 't1', snippet: 'hello', subject: 'Subject', from: 'a@example.com', date: 'today' }]),
  createDraft: jest.fn().mockResolvedValue({ id: 'draft-1', messageId: 'message-1' }),
}));

import { gmailCreateDraftTool, gmailSearchMessagesTool } from '@/lib/ai/tools/connectors-tools';
import { createDraft, searchEmails } from '@/lib/google/google-gmail';

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
});
