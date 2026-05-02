import { z } from 'zod';
import { defineTool, ToolContext } from './Tool';
import { searchEmails, createDraft } from '@/lib/google/google-gmail';

async function getGoogleAccountId(context: ToolContext): Promise<string | null> {
  const { data, error } = await context.supabase
    .from('linked_accounts')
    .select('id')
    .eq('user_id', context.user.id)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .eq('provider', 'google')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.id;
}

export const connectorsListTool = defineTool({
  name: 'connectors.list',
  description: `Lists the external accounts (Google, etc.) the user has linked to Flowme.

WHEN TO USE: user asks "what's connected", "do I have Gmail linked", "which Google accounts can you see"; or you need to check capability before suggesting actions ("can you read my email?" — call this first).

CONTRACT:
- No inputs.
- Read-only. Cheap. Safe to call before any cross-account workflow.

RETURNS receipt.accounts[]: { id, provider, name, is_active }.
- id is an internal linked_account UUID — TECHNICAL, never expose.
- provider ('google', etc.) and name (account display name / email) are user-facing — fine to mention.
- is_active=false means token expired or user disconnected — surface as "your X account needs to be reconnected", not as the raw flag.

ASK THE USER FIRST IF: nothing — this is informational, never destructive.`,
  isReadOnly: true,
  inputSchema: z.object({}),
  call: async (args, context) => {
    const { data, error } = await context.supabase
      .from('linked_accounts')
      .select('id, provider, name, is_active')
      .eq('user_id', context.user.id)
      .eq('is_deleted', false);

    if (error) {
      return { ok: false, error: 'Failed to fetch connected accounts.' };
    }

    return {
      ok: true,
      receipt: { accounts: data }
    };
  }
});

export const gmailSearchMessagesTool = defineTool({
  name: 'gmail.search_messages',
  description: `Searches the user's Gmail using Google's standard search syntax. Read-only — does not open, mark, or modify anything.

WHEN TO USE: user says "find emails from…", "did Anna reply about…", "show me unread invoices", "what did marketing send last week"; or you need recent context before drafting a reply.

CONTRACT:
- query uses Gmail's native operators: from:, to:, subject:, has:attachment, is:unread, after:YYYY/MM/DD, label:inbox, etc. Plain text also works as full-text search.
- For relative dates, translate to absolute first (today is in context.nowIso) — Gmail does not understand "yesterday".
- max_results defaults to 10. Each result costs an extra metadata fetch, so don't request more than needed.
- Read-only. Safe to chain before gmail.create_draft.

RETURNS receipt: { messages[], count }. Each message: { id, threadId, snippet, subject, from, date }.
- id and threadId are Gmail technical IDs — NEVER read aloud or quote. Keep them only if a follow-up tool needs them.
- subject, from, date, snippet are user-facing — summarise them naturally ("Anna replied yesterday saying…"). Don't dump JSON.
- If count is 0, say so plainly — do not invent results.

ASK THE USER FIRST IF: the query is broad enough to be sensitive ("all emails from my boss"), or they asked you to do something AFTER finding the email (reply, forward) — confirm before drafting.`,
  isReadOnly: true,
  inputSchema: z.object({
    query: z.string().describe('Gmail search expression. Supports operators (from:, to:, subject:, is:unread, has:attachment, after:YYYY/MM/DD, label:…) and free-text. Translate relative dates to absolute.'),
    max_results: z.number().optional().default(10).describe('Cap on returned messages. Default 10. Keep small — each result triggers a metadata fetch.'),
  }),
  call: async (args, context) => {
    const accountId = await getGoogleAccountId(context);
    if (!accountId) return { ok: false, error: 'No active Google account connected.' };

    try {
      const messages = await searchEmails(accountId, args.query, args.max_results);
      return {
        ok: true,
        receipt: { messages, count: messages.length }
      };
    } catch (e: any) {
      const googleMsg = e?.response?.data?.error?.message || e?.errors?.[0]?.message || e?.message;
      const errCode = e?.response?.data?.error?.code || e?.code;
      const status = e?.response?.data?.error?.status;
      let detailedError = errCode && googleMsg ? `Google API ${errCode}: ${googleMsg}` : (googleMsg || 'Failed to search Gmail');
      if (errCode === 401 || errCode === 403 || status === 'PERMISSION_DENIED' || /scope|consent|authoriz/i.test(googleMsg || '')) {
        detailedError = `Gmail access denied. The user likely needs to reconnect their Google account with Gmail scope. Original: ${googleMsg}`;
      }
      console.error('[gmail.search_messages] Google API error:', { errCode, status, googleMsg });
      return { ok: false, error: detailedError };
    }
  }
});

export const gmailCreateDraftTool = defineTool({
  name: 'gmail.create_draft',
  description: `Saves an email DRAFT in the user's Gmail. Does NOT send. The draft appears in their Drafts folder for them to review and send manually.

WHEN TO USE: user says "draft a reply", "write an email to…", "prepare a follow-up", "respond to that email". Default to drafting, never sending — Flowme has no send tool by design.

CONTRACT:
- to (array of email addresses), subject, and body are ALL required.
- Never invent recipient addresses. If the user says "email Anna", call gmail.search_messages first to find her address, or ask.
- body is plain text (UTF-8). Use real line breaks for paragraphs. No markdown, no HTML — Gmail will show literal characters.
- Side effects: a Drafts entry appears in the user's Gmail. Idempotent in spirit but each call creates a NEW draft — don't retry on success.

RETURNS receipt: { draft_id, message_id, status: 'draft_created' }.
- draft_id and message_id are TECHNICAL — never show. Keep only if the user immediately asks to edit/discard.
- Confirm to the user in plain language: "I've drafted the reply in your Gmail — ready for you to review and send."

ASK THE USER FIRST IF: recipients are ambiguous or unverified, the email is sensitive (legal, financial, HR), or you don't have enough context to write a good body. Show the proposed body in chat and confirm before drafting if the user hasn't already approved the content.`,
  isReadOnly: false,
  inputSchema: z.object({
    to: z.array(z.string()).describe('Recipient email addresses. Required. Use real, verified addresses — do not guess.'),
    subject: z.string().describe('Email subject line. Required.'),
    body: z.string().describe('Plain-text body. Required. Use \\n for line breaks. No markdown or HTML — characters render literally in Gmail.'),
  }),
  call: async (args, context) => {
    const accountId = await getGoogleAccountId(context);
    if (!accountId) return { ok: false, error: 'No active Google account connected.' };

    try {
      const draft = await createDraft(accountId, args.to, args.subject, args.body);
      return {
        ok: true,
        receipt: { draft_id: draft.id, message_id: draft.messageId, status: 'draft_created' }
      };
    } catch (e: any) {
      const googleMsg = e?.response?.data?.error?.message || e?.errors?.[0]?.message || e?.message;
      const errCode = e?.response?.data?.error?.code || e?.code;
      const status = e?.response?.data?.error?.status;
      let detailedError = errCode && googleMsg ? `Google API ${errCode}: ${googleMsg}` : (googleMsg || 'Failed to create Gmail draft');
      if (errCode === 401 || errCode === 403 || status === 'PERMISSION_DENIED' || /scope|consent|authoriz/i.test(googleMsg || '')) {
        detailedError = `Gmail access denied. The user likely needs to reconnect their Google account with Gmail scope. Original: ${googleMsg}`;
      }
      console.error('[gmail.create_draft] Google API error:', { errCode, status, googleMsg });
      return { ok: false, error: detailedError };
    }
  }
});
