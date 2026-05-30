import { getValidSlackToken } from '@/lib/slack/slack-auth';
import { ErrorCode } from '@/lib/api/errors';

function makeSupabase(record: any, updateSpy?: jest.Mock) {
  return {
    from(_table: string) {
      const chain: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        update: jest.fn((patch: any) => { updateSpy?.(patch); return chain; }),
        single: jest.fn().mockResolvedValue({ data: record, error: record ? null : { message: 'not found' } }),
      };
      return chain;
    },
  } as any;
}

const ctx = (record: any, updateSpy?: jest.Mock) => ({ supabase: makeSupabase(record, updateSpy), user: { id: 'u1' } });

describe('slack-auth.getValidSlackToken', () => {
  const originalEnv = process.env;
  beforeEach(() => { process.env = { ...originalEnv, SLACK_CLIENT_ID: 'cid', SLACK_CLIENT_SECRET: 'csec' }; });
  afterEach(() => { process.env = originalEnv; jest.restoreAllMocks(); });

  it('returns the stored token when expiry is null (rotation off)', async () => {
    const { token } = await getValidSlackToken('la1', ctx({ access_token: 'xoxp-1', refresh_token: null, expiry: null }) as any);
    expect(token).toBe('xoxp-1');
  });

  it('returns the stored token when not expired', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { token } = await getValidSlackToken('la1', ctx({ access_token: 'xoxp-2', refresh_token: 'rt', expiry: future }) as any);
    expect(token).toBe('xoxp-2');
  });

  it('throws SLACK_AUTH_MISSING when there is no record', async () => {
    await expect(getValidSlackToken('la1', ctx(null) as any)).rejects.toThrow(ErrorCode.SLACK_AUTH_MISSING);
  });

  it('refreshes and persists when expired and a refresh token exists', async () => {
    const past = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const updateSpy = jest.fn();
    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        authed_user: { access_token: 'xoxp-NEW', refresh_token: 'rt-NEW', expires_in: 3600 },
      }),
    } as any);

    const { token } = await getValidSlackToken('la1', ctx({ access_token: 'xoxp-OLD', refresh_token: 'rt-OLD', expiry: past }, updateSpy) as any);

    expect(token).toBe('xoxp-NEW');
    expect(fetchMock).toHaveBeenCalledWith('https://slack.com/api/oauth.v2.access', expect.objectContaining({ method: 'POST' }));
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ access_token: 'xoxp-NEW', refresh_token: 'rt-NEW' }));
  });

  it('throws SLACK_TOKEN_REFRESH_FAILED when expired without a refresh token', async () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString();
    await expect(
      getValidSlackToken('la1', ctx({ access_token: 'xoxp-X', refresh_token: null, expiry: past }) as any),
    ).rejects.toThrow(ErrorCode.SLACK_TOKEN_REFRESH_FAILED);
  });

  it('throws SLACK_TOKEN_REFRESH_FAILED when Slack rejects the refresh', async () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString();
    jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false, error: 'invalid_refresh_token' }),
    } as any);
    await expect(
      getValidSlackToken('la1', ctx({ access_token: 'x', refresh_token: 'rt', expiry: past }) as any),
    ).rejects.toThrow(ErrorCode.SLACK_TOKEN_REFRESH_FAILED);
  });
});
