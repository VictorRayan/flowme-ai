import { z } from 'zod';
import { defineTool, type ToolContext } from './Tool';
import { getValidSlackClient } from '@/lib/slack/slack-auth';
import {
  listConversations,
  readChannelHistory,
  readThread,
  getUserInfo,
  getPermalink,
  postMessage,
  type SlackMessageHit,
} from '@/lib/slack/slack-client';

const NOT_CONNECTED_ERROR =
  'Slack não conectado. Vá em Configurações → Conexões e conecte um workspace antes de tentar de novo.';

async function getSlackAccountId(context: ToolContext): Promise<string | null> {
  const { data: slackConnector } = await context.supabase
    .from('connectors')
    .select('config')
    .eq('user_id', context.user.id)
    .eq('type', 'slack')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const fromConnector = slackConnector?.config?.linked_account_id as string | undefined;
  if (fromConnector) return fromConnector;

  const { data: account } = await context.supabase
    .from('linked_accounts')
    .select('id')
    .eq('user_id', context.user.id)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .eq('provider', 'slack')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return account?.id || null;
}

async function withSlackClient<T>(
  context: ToolContext,
  run: (client: import('@slack/web-api').WebClient) => Promise<T>,
): Promise<{ ok: true; receipt: T } | { ok: false; error: string }> {
  const linkedAccountId = await getSlackAccountId(context);
  if (!linkedAccountId) return { ok: false, error: NOT_CONNECTED_ERROR };
  try {
    const client = await getValidSlackClient(linkedAccountId, { supabase: context.supabase, user: context.user });
    const receipt = await run(client);
    return { ok: true, receipt };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Slack call failed';
    return { ok: false, error: `Slack error: ${message}` };
  }
}

export const slackListChannelsTool = defineTool({
  name: 'slack.list_channels',
  description: `List channels and DMs the user has access to.

WHEN TO USE: choosing where to post, resolving a channel name to an ID, listing what's available.

CONTRACT:
- types: comma-separated Slack types (default 'public_channel,private_channel,im').
- limit: max channels (1–1000, default 100).
- Returns: id, name, is_private, is_im, topic. Read-only.`,
  isReadOnly: true,
  inputSchema: z.object({
    types: z.string().optional(),
    limit: z.number().int().min(1).max(1000).optional(),
  }),
  call: async (args, context) => withSlackClient(context, (client) => listConversations(client, { types: args.types, limit: args.limit })),
});

export const slackReadChannelTool = defineTool({
  name: 'slack.read_channel',
  description: `Read recent messages from a single channel or DM.

WHEN TO USE: "what's new in #channel", "summarize the last 20 messages from X".

CONTRACT:
- channel: channel/DM ID (use slack.list_channels to resolve names → IDs).
- limit: 1–200, default 20.
- Read-only.`,
  isReadOnly: true,
  inputSchema: z.object({
    channel: z.string().min(1).describe('Channel or DM ID (e.g. C0123 / D0456).'),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  call: async (args, context) => withSlackClient(context, (client) => readChannelHistory(client, args.channel, args.limit ?? 20)),
});

export const slackReadThreadTool = defineTool({
  name: 'slack.read_thread',
  description: `Read the full replies of a thread.

CONTRACT:
- channel: channel ID where the thread lives.
- thread_ts: the parent message timestamp (e.g. "1700000000.123456").
- limit: max replies (1–200, default 100).
- Read-only.`,
  isReadOnly: true,
  inputSchema: z.object({
    channel: z.string().min(1),
    thread_ts: z.string().min(1),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  call: async (args, context) => withSlackClient(context, (client) => readThread(client, args.channel, args.thread_ts, args.limit ?? 100)),
});

export const slackGetUserTool = defineTool({
  name: 'slack.get_user',
  description: `Look up profile info for a Slack user ID (real name, email, timezone). Read-only.`,
  isReadOnly: true,
  inputSchema: z.object({ user_id: z.string().min(1) }),
  call: async (args, context) => withSlackClient(context, (client) => getUserInfo(client, args.user_id)),
});

export const slackScanRecentHistoryTool = defineTool({
  name: 'slack.scan_recent_history',
  description: `Scan recent messages across the channels and DMs the user has access to, filter by a keyword, and return the best matches. Use this when the user wants to find a message but does not know where it lives — e.g. "find the message about the launch", "who told me about the Q3 budget?".

CONTRACT:
- query: case-insensitive substring to look for in message text. 2–200 chars.
- days_back: how far back to scan in days (default 7, max 30). Longer windows cost more API calls.
- limit_channels: how many channels/DMs to scan (default 20, max 50). The tool picks the most recently active conversations the user belongs to.
- types: comma-separated Slack conversation types (default 'public_channel,private_channel,im,mpim').
- Returns up to 10 matches with channel name, sender, text, ts and a Slack permalink. Sorted newest first. Read-only.

LIMITATIONS:
- We cannot search globally the way Slack search does — the user's app does not have search:read (Slack Marketplace policy). This tool is the workaround.
- Older messages and unjoined channels are NOT scanned. If the match is older than days_back or in a channel the user is not in, it will be missed.
- If the user names a specific channel, prefer slack.read_channel for a focused read; use this tool only for "I don't know where" searches.`,
  isReadOnly: true,
  inputSchema: z.object({
    query: z.string().min(2).max(200),
    days_back: z.number().int().min(1).max(30).optional(),
    limit_channels: z.number().int().min(1).max(50).optional(),
    types: z.string().optional(),
  }),
  call: async (args, context) => withSlackClient(context, async (client) => {
    const daysBack = args.days_back ?? 7;
    const limitChannels = args.limit_channels ?? 20;
    const oldest = ((Date.now() - daysBack * 24 * 60 * 60 * 1000) / 1000).toFixed(6);
    const needle = args.query.toLowerCase();

    const channels = await listConversations(client, {
      types: args.types || 'public_channel,private_channel,im,mpim',
      limit: limitChannels,
    });
    if (channels.length === 0) return { matches: [], scanned_channels: 0 };

    const results = await Promise.allSettled(
      channels.map(async (channel) => {
        const messages = await readChannelHistory(client, channel.id, 100, oldest);
        return messages
          .filter((m) => m.text && m.text.toLowerCase().includes(needle))
          .map((m) => ({ ...m, channel_name: channel.name }));
      }),
    );

    const hits: SlackMessageHit[] = [];
    for (const r of results) if (r.status === 'fulfilled') hits.push(...r.value);

    hits.sort((a, b) => Number(b.ts) - Number(a.ts));
    const top = hits.slice(0, 10);

    await Promise.all(top.map(async (m) => {
      if (m.channel_id && m.ts) m.permalink = await getPermalink(client, m.channel_id, m.ts);
    }));

    return { matches: top, scanned_channels: channels.length };
  }),
});

export const slackSendMessageTool = defineTool({
  name: 'slack.send_message',
  description: `Post a message to a Slack channel/DM or reply in a thread, **as the user**.

WRITE — requires explicit user confirmation in chat before calling (mirror the pattern of goals.delete_plan). Never call this off the back of an ambiguous request.

CONTRACT:
- channel: channel/DM ID.
- text: message body (plain text or Slack mrkdwn).
- thread_ts: optional parent ts to reply in a thread.
- confirmed: must be true; the model must ask the user before setting it.
- Returns: { channel, ts }.`,
  isReadOnly: false,
  inputSchema: z.object({
    channel: z.string().min(1),
    text: z.string().min(1).max(40000),
    thread_ts: z.string().optional(),
    confirmed: z.boolean().describe('Set to true ONLY after the user has explicitly confirmed sending this message.'),
  }),
  call: async (args, context) => {
    if (!args.confirmed) {
      return { ok: false, error: 'Refusing to send: confirmed=false. Ask the user to confirm the message before retrying.' };
    }
    return withSlackClient(context, (client) => postMessage(client, args.channel, args.text, args.thread_ts));
  },
});

export const SLACK_TOOLS = [
  slackListChannelsTool,
  slackReadChannelTool,
  slackReadThreadTool,
  slackScanRecentHistoryTool,
  slackGetUserTool,
  slackSendMessageTool,
];
