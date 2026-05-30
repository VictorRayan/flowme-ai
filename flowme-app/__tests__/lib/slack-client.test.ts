import {
  listConversations,
  readChannelHistory,
  readThread,
  getUserInfo,
  postMessage,
  getSlackClient,
} from '@/lib/slack/slack-client';

type Mock = jest.Mock;

function makeClient(overrides: Record<string, Mock> = {}) {
  return {
    conversations: {
      list: overrides.list || jest.fn(),
      history: overrides.history || jest.fn(),
      replies: overrides.replies || jest.fn(),
    },
    users: { info: overrides.userInfo || jest.fn() },
    chat: { postMessage: overrides.postMessage || jest.fn() },
  } as any;
}

describe('slack-client', () => {
  it('getSlackClient throws when token is empty', () => {
    expect(() => getSlackClient('')).toThrow(/required/);
  });

  it('listConversations returns lite shape and excludes archived', async () => {
    const fn = jest.fn().mockResolvedValue({
      ok: true,
      channels: [
        { id: 'C1', name: 'general', is_private: false, is_im: false, is_member: true, topic: { value: 'team chat' } },
        { id: 'D1', name: '', user: 'U2', is_im: true, is_private: false },
      ],
    });
    const client = makeClient({ list: fn });
    const channels = await listConversations(client, { limit: 50 });
    expect(channels[0]).toEqual(expect.objectContaining({ id: 'C1', name: 'general', topic: 'team chat' }));
    expect(channels[1].is_im).toBe(true);
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ exclude_archived: true, limit: 50 }));
  });

  it('readThread maps messages and keeps thread_ts when absent', async () => {
    const fn = jest.fn().mockResolvedValue({
      ok: true,
      messages: [
        { user: 'U1', text: 'root', ts: '10.0' },
        { user: 'U2', text: 'reply', ts: '10.1', thread_ts: '10.0' },
      ],
    });
    const client = makeClient({ replies: fn });
    const out = await readThread(client, 'C1', '10.0');
    expect(out).toHaveLength(2);
    expect(out[0].thread_ts).toBe('10.0');
    expect(out[1].thread_ts).toBe('10.0');
  });

  it('readChannelHistory clamps the limit', async () => {
    const fn = jest.fn().mockResolvedValue({ ok: true, messages: [] });
    const client = makeClient({ history: fn });
    await readChannelHistory(client, 'C1', 9999);
    expect(fn).toHaveBeenCalledWith({ channel: 'C1', limit: 200 });
  });

  it('getUserInfo returns null when no user', async () => {
    const client = makeClient({ userInfo: jest.fn().mockResolvedValue({ ok: true }) });
    expect(await getUserInfo(client, 'U1')).toBeNull();
  });

  it('postMessage returns channel + ts and surfaces Slack errors', async () => {
    const fn = jest.fn().mockResolvedValue({ ok: true, channel: 'C1', ts: '42.0' });
    const client = makeClient({ postMessage: fn });
    const out = await postMessage(client, 'C1', 'hello', '10.0');
    expect(out).toEqual({ channel: 'C1', ts: '42.0', permalink: null });
    expect(fn).toHaveBeenCalledWith({ channel: 'C1', text: 'hello', thread_ts: '10.0' });

    const failing = makeClient({ postMessage: jest.fn().mockResolvedValue({ ok: false, error: 'not_in_channel' }) });
    await expect(postMessage(failing, 'C1', 'x')).rejects.toThrow(/not_in_channel/);
  });
});
