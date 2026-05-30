import { WebClient, type WebAPICallResult } from '@slack/web-api';

export interface SlackMessageHit {
  text: string;
  user_id: string | null;
  user_name: string | null;
  channel_id: string | null;
  channel_name: string | null;
  ts: string;
  thread_ts: string | null;
  permalink: string | null;
}

export interface SlackChannelLite {
  id: string;
  name: string;
  is_private: boolean;
  is_im: boolean;
  is_member?: boolean;
  topic?: string | null;
}

export interface SlackUserLite {
  id: string;
  name: string | null;
  real_name: string | null;
  email: string | null;
  tz: string | null;
}

export interface SlackPostedMessage {
  channel: string;
  ts: string;
  permalink: string | null;
}

export function getSlackClient(token: string): WebClient {
  if (!token) throw new Error('Slack token is required');
  return new WebClient(token);
}

function check(result: WebAPICallResult, label: string): void {
  if (!result.ok) {
    const reason = (result as unknown as { error?: string }).error || 'unknown_error';
    throw new Error(`Slack ${label} failed: ${reason}`);
  }
}

export async function listConversations(
  client: WebClient,
  opts: { types?: string; limit?: number } = {},
): Promise<SlackChannelLite[]> {
  const result = await client.conversations.list({
    types: opts.types || 'public_channel,private_channel,im',
    limit: Math.min(Math.max(opts.limit ?? 100, 1), 1000),
    exclude_archived: true,
  });
  check(result, 'conversations.list');
  const channels = (result as any).channels as any[] | undefined;
  if (!Array.isArray(channels)) return [];
  return channels.map((c) => ({
    id: String(c.id),
    name: String(c.name || c.user || c.id),
    is_private: Boolean(c.is_private),
    is_im: Boolean(c.is_im),
    is_member: c.is_member ?? undefined,
    topic: c.topic?.value || null,
  }));
}

export async function readChannelHistory(
  client: WebClient,
  channel: string,
  limit = 20,
  oldest?: string,
): Promise<SlackMessageHit[]> {
  const result = await client.conversations.history({ channel, limit: Math.min(Math.max(limit, 1), 200), oldest });
  check(result, 'conversations.history');
  const messages = (result as any).messages as any[] | undefined;
  if (!Array.isArray(messages)) return [];
  return messages.map((m) => ({
    text: String(m.text || ''),
    user_id: m.user || null,
    user_name: m.username || null,
    channel_id: channel,
    channel_name: null,
    ts: String(m.ts || ''),
    thread_ts: m.thread_ts || null,
    permalink: null,
  }));
}

export async function getPermalink(client: WebClient, channel: string, ts: string): Promise<string | null> {
  try {
    const result = await client.chat.getPermalink({ channel, message_ts: ts });
    if (!result.ok) return null;
    return (result as any).permalink || null;
  } catch {
    return null;
  }
}

export async function readThread(
  client: WebClient,
  channel: string,
  thread_ts: string,
  limit = 100,
): Promise<SlackMessageHit[]> {
  const result = await client.conversations.replies({ channel, ts: thread_ts, limit: Math.min(Math.max(limit, 1), 200) });
  check(result, 'conversations.replies');
  const messages = (result as any).messages as any[] | undefined;
  if (!Array.isArray(messages)) return [];
  return messages.map((m) => ({
    text: String(m.text || ''),
    user_id: m.user || null,
    user_name: m.username || null,
    channel_id: channel,
    channel_name: null,
    ts: String(m.ts || ''),
    thread_ts: m.thread_ts || thread_ts,
    permalink: null,
  }));
}

export async function getUserInfo(client: WebClient, userId: string): Promise<SlackUserLite | null> {
  const result = await client.users.info({ user: userId });
  check(result, 'users.info');
  const user = (result as any).user;
  if (!user) return null;
  return {
    id: String(user.id),
    name: user.name || null,
    real_name: user.profile?.real_name || user.real_name || null,
    email: user.profile?.email || null,
    tz: user.tz || null,
  };
}

export async function postMessage(
  client: WebClient,
  channel: string,
  text: string,
  thread_ts?: string,
): Promise<SlackPostedMessage> {
  const result = await client.chat.postMessage({ channel, text, thread_ts });
  check(result, 'chat.postMessage');
  return {
    channel: String((result as any).channel || channel),
    ts: String((result as any).ts || ''),
    permalink: null,
  };
}

export async function revokeToken(client: WebClient): Promise<void> {
  await client.auth.revoke({ test: false }).catch(() => {
    // best-effort; failure to revoke remotely should not block local cleanup
  });
}
