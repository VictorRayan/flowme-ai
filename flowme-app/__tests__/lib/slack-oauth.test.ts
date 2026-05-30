import { buildSlackAuthorizeUrl, decodeSlackState, encodeSlackState, exchangeSlackCode, SLACK_USER_SCOPES } from '@/lib/slack/slack-oauth';

describe('slack-oauth state', () => {
  it('round-trips encode/decode and rejects garbage', () => {
    const state = { user_id: 'u1', linked_account_id: 'la1', connector_id: 'c1', return_to: '/app/connectors' };
    expect(decodeSlackState(encodeSlackState(state))).toEqual(state);
    expect(decodeSlackState('not-base64-json')).toBeNull();
    const missing = Buffer.from(JSON.stringify({ user_id: 'u1' })).toString('base64');
    expect(decodeSlackState(missing)).toBeNull();
  });
});

describe('buildSlackAuthorizeUrl', () => {
  it('uses user_scope (not bot scope) with the required scopes joined', () => {
    const url = new URL(buildSlackAuthorizeUrl({ clientId: 'cid', redirectUri: 'https://x/cb', state: 'st' }));
    expect(url.origin + url.pathname).toBe('https://slack.com/oauth/v2/authorize');
    expect(url.searchParams.get('client_id')).toBe('cid');
    expect(url.searchParams.get('redirect_uri')).toBe('https://x/cb');
    expect(url.searchParams.get('state')).toBe('st');
    expect(url.searchParams.get('user_scope')).toBe(SLACK_USER_SCOPES.join(','));
    // Bot scope must not be set — Balys posts as the user.
    expect(url.searchParams.get('scope')).toBeNull();
  });

  it('includes the read + write scopes but never the Marketplace-banned search:read', () => {
    expect(SLACK_USER_SCOPES).toContain('channels:history');
    expect(SLACK_USER_SCOPES).toContain('chat:write');
    // search:read is not permitted for Slack Marketplace apps.
    expect(SLACK_USER_SCOPES).not.toContain('search:read' as any);
  });
});

describe('exchangeSlackCode', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns the authed_user token, team info and (no) expiry when rotation is off', async () => {
    jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        team: { id: 'T1', name: 'Fluencypass' },
        authed_user: { id: 'U1', access_token: 'xoxp-1', scope: 'search:read,chat:write' },
      }),
    } as any);
    const result = await exchangeSlackCode({ code: 'c', clientId: 'i', clientSecret: 's', redirectUri: 'r' });
    expect(result).toEqual({
      user_access_token: 'xoxp-1',
      user_refresh_token: null,
      expiry: null,
      scopes: 'search:read,chat:write',
      slack_user_id: 'U1',
      slack_team_id: 'T1',
      slack_team_name: 'Fluencypass',
    });
  });

  it('computes expiry from expires_in when rotation is enabled', async () => {
    const now = Date.now();
    jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        team: { id: 'T1' },
        authed_user: { id: 'U1', access_token: 'xoxp-r', refresh_token: 'rt-1', expires_in: 7200 },
      }),
    } as any);
    const result = await exchangeSlackCode({ code: 'c', clientId: 'i', clientSecret: 's', redirectUri: 'r' });
    expect(result.user_refresh_token).toBe('rt-1');
    expect(result.expiry).not.toBeNull();
    expect(new Date(result.expiry!).getTime()).toBeGreaterThan(now + 7100 * 1000);
  });

  it('throws when Slack returns ok:false', async () => {
    jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false, error: 'invalid_code' }),
    } as any);
    await expect(exchangeSlackCode({ code: 'c', clientId: 'i', clientSecret: 's', redirectUri: 'r' }))
      .rejects.toThrow(/invalid_code/);
  });

  it('throws when no user access token is returned', async () => {
    jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, team: { id: 'T' }, authed_user: { id: 'U' } }),
    } as any);
    await expect(exchangeSlackCode({ code: 'c', clientId: 'i', clientSecret: 's', redirectUri: 'r' }))
      .rejects.toThrow(/user access token/);
  });
});
