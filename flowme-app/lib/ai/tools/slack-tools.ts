import { z } from 'zod';
import { defineTool, type ToolContext } from './Tool';
import { getValidSlackClient } from '@/lib/slack/slack-auth';
import {
  searchMessages,
  listConversations,
  readChannelHistory,
  readThread,
  getUserInfo,
  postMessage,
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

export const slackSearchMessagesTool = defineTool({
  name: 'slack.search_messages',
  description: `Keyword search across the user's Slack workspace via Slack's search API.

USE ONLY WHEN the user gives a CONCRETE search term (a topic, name, phrase, project, keyword). Examples that fit: "find the Slack message about the launch", "what did Anna say about Q3", "quem me falou do orçamento", "busca por 'maratona' no Slack".

DO NOT USE for browse-style requests with no search term:
- "show me recent Slack messages" → use slack.list_channels + slack.read_channel instead.
- "what's happening in my Slack" → use slack.list_channels first.
- "mensagens do canal X" → use slack.list_channels to resolve X, then slack.read_channel.

If the user has not provided a non-empty search term (≥2 chars), DO NOT call this tool — ask the user what term to search for, or switch to read_channel.

CONTRACT:
- query: REQUIRED. A non-empty Slack search query, 2–300 chars. Slack operators supported ("from:@anna budget", "in:#product roadmap", "before:2026-05-01 launch").
- count: max results (1–50, default 10).
- Returns: matches with text, sender, channel, ts, permalink. Read-only.`,
  isReadOnly: true,
  inputSchema: z.object({
    query: z.string().trim().min(2).max(300).describe('REQUIRED non-empty Slack search query (≥2 chars). Slack operators supported.'),
    count: z.number().int().min(1).max(50).optional().describe('Max matches, default 10.'),
  }),
  call: async (args, context) => withSlackClient(context, (client) => searchMessages(client, args.query, args.count ?? 10)),
});

export const slackListChannelsTool = defineTool({
  name: 'slack.list_channels',
  description: `List channels and DMs the user has access to.

WHEN TO USE:
- Broad browse requests: "quais são as mensagens recentes do slack?", "o que tem nos meus canais?", "show me what's in Slack" — start here, then call slack.read_channel on the relevant channels.
- Resolving a channel name mentioned by the user ("mensagens do canal social") into a channel ID before reading or posting.
- Showing the user what's available when they ask "que canais eu tenho?".

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

WHEN TO USE:
- "o que tem de novo no canal #X", "resume as últimas mensagens do canal Y", "quais foram as mensagens do canal Z hoje".
- Whenever the user wants a feed/recap of a specific channel, even if they ask in broader terms like "mensagens do canal social".
- For browse-style requests ("recent Slack messages") AFTER you've resolved which channels to look at via slack.list_channels — call this per channel.

DO NOT use slack.search_messages when the user just wants to read a channel — there is no keyword in a browse request.

CONTRACT:
- channel: channel/DM ID (use slack.list_channels to resolve names → IDs first).
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
  slackSearchMessagesTool,
  slackListChannelsTool,
  slackReadChannelTool,
  slackReadThreadTool,
  slackGetUserTool,
  slackSendMessageTool,
];
