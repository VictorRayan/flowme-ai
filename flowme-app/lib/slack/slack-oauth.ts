// Slack OAuth v2 helpers used by /api/auth/slack/{connect,callback}.

// User-token scopes for Balys (read + write on behalf of the user).
// search:read is intentionally NOT included — Slack does not allow it for
// Marketplace apps. Balys reads through conversations.history / replies and
// channel listings instead.
export const SLACK_USER_SCOPES = [
  'channels:history',
  'channels:read',
  'groups:history',
  'groups:read',
  'im:history',
  'im:read',
  'mpim:history',
  'mpim:read',
  'users:read',
  'chat:write',
] as const;

export interface SlackOAuthState {
  user_id: string;
  linked_account_id: string;
  connector_id?: string | null;
  return_to?: string;
}

export function encodeSlackState(state: SlackOAuthState): string {
  return Buffer.from(JSON.stringify(state)).toString('base64');
}

export function decodeSlackState(raw: string): SlackOAuthState | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString());
    if (!parsed?.user_id || !parsed?.linked_account_id) return null;
    return parsed as SlackOAuthState;
  } catch {
    return null;
  }
}

export function buildSlackAuthorizeUrl(opts: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.searchParams.set('client_id', opts.clientId);
  url.searchParams.set('user_scope', SLACK_USER_SCOPES.join(','));
  url.searchParams.set('redirect_uri', opts.redirectUri);
  url.searchParams.set('state', opts.state);
  return url.toString();
}

export interface SlackOAuthExchange {
  user_access_token: string;
  user_refresh_token: string | null;
  expiry: string | null;
  scopes: string | null;
  slack_user_id: string | null;
  slack_team_id: string | null;
  slack_team_name: string | null;
}

export async function exchangeSlackCode(opts: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<SlackOAuthExchange> {
  const body = new URLSearchParams({
    code: opts.code,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
  });
  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data: any = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(`Slack OAuth exchange failed: ${data?.error || res.statusText}`);
  }
  const authedUser = data.authed_user;
  if (!authedUser?.access_token) {
    throw new Error('Slack OAuth did not return a user access token');
  }
  const expiresIn = typeof authedUser.expires_in === 'number' ? authedUser.expires_in : null;
  return {
    user_access_token: authedUser.access_token,
    user_refresh_token: authedUser.refresh_token || null,
    expiry: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    scopes: authedUser.scope || null,
    slack_user_id: authedUser.id || null,
    slack_team_id: data.team?.id || null,
    slack_team_name: data.team?.name || null,
  };
}
