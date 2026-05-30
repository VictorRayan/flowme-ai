import {
  slackSearchMessagesTool,
  slackListChannelsTool,
  slackReadChannelTool,
  slackSendMessageTool,
} from '@/lib/ai/tools/slack-tools';

const mockSearch = jest.fn();
const mockList = jest.fn();
const mockHistory = jest.fn();
const mockPost = jest.fn();

jest.mock('@/lib/slack/slack-auth', () => ({
  getValidSlackClient: jest.fn(async () => ({
    search: { messages: mockSearch },
    conversations: { list: mockList, history: mockHistory },
    chat: { postMessage: mockPost },
  })),
}));

function makeContext(connectorRow: any, accountRow: any = null) {
  return {
    supabase: {
      from(table: string) {
        const chain: any = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: table === 'connectors' ? connectorRow : accountRow,
            error: null,
          }),
        };
        return chain;
      },
    },
    user: { id: 'u1' },
    timezone: 'America/Sao_Paulo',
    nowIso: '2026-05-29T12:00:00.000Z',
  } as any;
}

beforeEach(() => {
  mockSearch.mockReset();
  mockList.mockReset();
  mockHistory.mockReset();
  mockPost.mockReset();
});

describe('slack-tools — connector resolution', () => {
  it('returns the not-connected error when neither connector nor linked account exists', async () => {
    const ctx = makeContext(null, null);
    const r = await slackSearchMessagesTool.call({ query: 'hi' }, ctx);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Configurações → Conexões/);
  });

  it('uses the connector linked_account_id when one is active', async () => {
    mockSearch.mockResolvedValue({ ok: true, messages: { matches: [] } });
    const ctx = makeContext({ config: { linked_account_id: 'la-1' } });
    const r = await slackSearchMessagesTool.call({ query: 'hi' }, ctx);
    expect(r.ok).toBe(true);
  });
});

describe('slack-tools — read tools', () => {
  const ctx = () => makeContext({ config: { linked_account_id: 'la-1' } });

  it('search returns the matches from the client', async () => {
    mockSearch.mockResolvedValue({ ok: true, messages: { matches: [{ text: 'oi', user: 'U1', channel: { id: 'C1', name: 'general' }, ts: '1.0' }] } });
    const r: any = await slackSearchMessagesTool.call({ query: 'oi' }, ctx());
    expect(r.ok).toBe(true);
    expect(r.receipt[0]).toEqual(expect.objectContaining({ text: 'oi', channel_id: 'C1' }));
  });

  it('list_channels exposes private vs DM flags', async () => {
    mockList.mockResolvedValue({ ok: true, channels: [{ id: 'D1', is_im: true, is_private: false }] });
    const r: any = await slackListChannelsTool.call({}, ctx());
    expect(r.receipt[0].is_im).toBe(true);
  });

  it('read_channel forwards the limit', async () => {
    mockHistory.mockResolvedValue({ ok: true, messages: [] });
    await slackReadChannelTool.call({ channel: 'C1', limit: 5 }, ctx());
    expect(mockHistory).toHaveBeenCalledWith({ channel: 'C1', limit: 5 });
  });
});

describe('slack-tools — send_message (write, requires confirmation)', () => {
  const ctx = () => makeContext({ config: { linked_account_id: 'la-1' } });

  it('refuses to call Slack when confirmed=false', async () => {
    const r: any = await slackSendMessageTool.call({ channel: 'C1', text: 'hi', confirmed: false }, ctx());
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/confirmed=false/);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('posts when confirmed=true', async () => {
    mockPost.mockResolvedValue({ ok: true, channel: 'C1', ts: '42.0' });
    const r: any = await slackSendMessageTool.call({ channel: 'C1', text: 'hi', confirmed: true }, ctx());
    expect(r.ok).toBe(true);
    expect(r.receipt).toEqual({ channel: 'C1', ts: '42.0', permalink: null });
    expect(mockPost).toHaveBeenCalledWith({ channel: 'C1', text: 'hi', thread_ts: undefined });
  });

  it('is marked as not read-only', () => {
    expect(slackSendMessageTool.isReadOnly).toBe(false);
  });
});
