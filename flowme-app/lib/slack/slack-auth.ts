import { ErrorCode } from '../api/errors';
import { getSlackClient } from './slack-client';
import type { WebClient } from '@slack/web-api';

export interface SlackTokenAuthContext {
  supabase: any;
  user: { id: string };
}

export interface SlackTokenRecord {
  access_token: string;
  refresh_token: string | null;
  expiry: string | null;
  slack_team_id: string | null;
  slack_team_name: string | null;
  slack_user_id: string | null;
  scopes: string | null;
}

const SLACK_OAUTH_URL = 'https://slack.com/api/oauth.v2.access';
const EXPIRY_SKEW_MS = 5 * 60 * 1000;

function isExpired(expiry: string | null): boolean {
  if (!expiry) return false;
  return Date.now() >= new Date(expiry).getTime() - EXPIRY_SKEW_MS;
}

async function refreshSlackToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string | null;
  expiry: string | null;
}> {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error(ErrorCode.SLACK_TOKEN_REFRESH_FAILED);

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(SLACK_OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data: any = await res.json().catch(() => null);
  if (!res.ok || !data?.ok || !data?.authed_user?.access_token) {
    throw new Error(ErrorCode.SLACK_TOKEN_REFRESH_FAILED);
  }
  const authedUser = data.authed_user;
  const expiresIn = typeof authedUser.expires_in === 'number' ? authedUser.expires_in : null;
  return {
    access_token: authedUser.access_token,
    refresh_token: authedUser.refresh_token || refreshToken,
    expiry: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
  };
}

export async function getValidSlackToken(
  linkedAccountId: string,
  authContext: SlackTokenAuthContext,
): Promise<{ token: string; record: SlackTokenRecord }> {
  const { supabase } = authContext;

  const { data: record, error } = await supabase
    .from('user_slack_tokens')
    .select('access_token, refresh_token, expiry, slack_team_id, slack_team_name, slack_user_id, scopes')
    .eq('linked_account_id', linkedAccountId)
    .single();

  if (error || !record) throw new Error(ErrorCode.SLACK_AUTH_MISSING);

  if (!isExpired(record.expiry)) {
    return { token: record.access_token, record };
  }

  if (!record.refresh_token) {
    throw new Error(ErrorCode.SLACK_TOKEN_REFRESH_FAILED);
  }

  const refreshed = await refreshSlackToken(record.refresh_token);
  await supabase
    .from('user_slack_tokens')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expiry: refreshed.expiry,
    })
    .eq('linked_account_id', linkedAccountId);

  return {
    token: refreshed.access_token,
    record: { ...record, access_token: refreshed.access_token, refresh_token: refreshed.refresh_token, expiry: refreshed.expiry },
  };
}

export async function getValidSlackClient(
  linkedAccountId: string,
  authContext: SlackTokenAuthContext,
): Promise<WebClient> {
  const { token } = await getValidSlackToken(linkedAccountId, authContext);
  return getSlackClient(token);
}
