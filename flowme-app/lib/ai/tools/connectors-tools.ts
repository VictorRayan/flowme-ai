import { z } from 'zod';
import { defineTool, ToolContext } from './Tool';
import { searchEmails, createDraft } from '@/lib/google/google-gmail';
import { google } from 'googleapis';
import { getGoogleOAuthClient } from '@/lib/google/google-auth';
import { runSheetsAgent } from '@/lib/ai/agents/sheets-agent';
import { runDocsAgent } from '@/lib/ai/agents/docs-agent';

/* ── helpers ── */

async function getGoogleAccountId(context: ToolContext): Promise<string | null> {
  // Prefer an authorized Gmail connector over a generic linked account
  const { data: gmailConnector } = await context.supabase
    .from('connectors')
    .select('config')
    .eq('user_id', context.user.id)
    .eq('type', 'gmail')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (gmailConnector?.config?.linked_account_id) {
    return gmailConnector.config.linked_account_id as string;
  }

  // Fall back to any active Google linked account (e.g. Calendar account)
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

async function getAuthorizedClient(linkedAccountId: string, supabase: any) {
  const { data: tokenRow } = await supabase
    .from('user_google_tokens')
    .select('access_token, refresh_token, expiry')
    .eq('linked_account_id', linkedAccountId)
    .maybeSingle();
  if (!tokenRow?.access_token) return null;

  const oauth2 = getGoogleOAuthClient();
  oauth2.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
    expiry_date: tokenRow.expiry ? new Date(tokenRow.expiry).getTime() : undefined,
  });
  return oauth2;
}

async function getConnectorLinkedAccountId(
  context: ToolContext,
  connectorId: string,
): Promise<string | null> {
  const { data } = await context.supabase
    .from('connectors')
    .select('config, is_active')
    .eq('id', connectorId)
    .eq('user_id', context.user.id)
    .maybeSingle();
  if (!data?.is_active || !data?.config?.linked_account_id) return null;
  return data.config.linked_account_id as string;
}

/* ── tools ── */

export const connectorsListTool = defineTool({
  name: 'connectors.list',
  description: `Lists all connectors the user has added, including their authorization status.

WHEN TO USE: user asks "what's connected", "do I have Gmail linked", "which sources can you access"; or before using a connector tool to verify it's authorized.

CONTRACT:
- Read-only. Returns connectors from the Connectors page (not just linked Google accounts).
- Each connector has: id, name, type, is_authorized (true = OAuth completed, Balys can read it), is_active.
- is_authorized=false means the user added the connector but hasn't completed Google authorization yet.
- Surface "not yet authorized" connectors as "needs setup" to the user — link them to /app/connectors.
- id is TECHNICAL — never expose. Use name and type in responses.`,
  isReadOnly: true,
  inputSchema: z.object({}),
  call: async (args, context) => {
    const { data: connectors, error } = await context.supabase
      .from('connectors')
      .select('id, name, type, is_active, config, created_at')
      .eq('user_id', context.user.id)
      .order('created_at', { ascending: true });

    if (error) return { ok: false, error: 'Failed to fetch connectors.' };

    const result = (connectors || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      is_active: c.is_active,
      is_authorized: Boolean(c.config?.linked_account_id) && c.is_active,
    }));

    return { ok: true, receipt: { connectors: result, count: result.length } };
  },
});

export const connectorsReadSheetTool = defineTool({
  name: 'connectors.read_sheet',
  description: `Reads data from a Google Sheets connector. Returns the raw cell values from the specified range.

WHEN TO USE: user says "check my financial sheet", "what's in my spreadsheet", "read the data from [connector name]"; or you need to pull structured data for analysis.

CONTRACT:
- connector_id: required. Get it from connectors.list — match by name, use the id.
- range: A1 notation, e.g. "Sheet1!A1:D20". Defaults to first 100 rows if omitted.
- Returns rows as arrays of cell values. Empty cells are empty strings.
- Read-only. Never modifies the sheet.
- If the connector is not authorized, tell the user to go to /app/connectors to complete setup.

RETURNS receipt: { rows, row_count, sheet_title }`,
  isReadOnly: true,
  inputSchema: z.object({
    connector_id: z.string().describe('The connector id from connectors.list. Match by name, pass the id.'),
    range: z.string().optional().describe('A1 notation range, e.g. "Sheet1!A1:D50". Omit for first 100 rows of default sheet.'),
  }),
  call: async (args, context) => {
    const linkedAccountId = await getConnectorLinkedAccountId(context, args.connector_id);
    if (!linkedAccountId) return { ok: false, error: 'Connector not authorized. Ask the user to go to /app/connectors and click Authorize.' };

    const auth = await getAuthorizedClient(linkedAccountId, context.supabase);
    if (!auth) return { ok: false, error: 'Could not get Google credentials for this connector.' };

    try {
      const sheets = google.sheets({ version: 'v4', auth });

      // Get spreadsheet metadata first to find the sheet ID from config
      const { data: connectorRow } = await context.supabase
        .from('connectors')
        .select('config')
        .eq('id', args.connector_id)
        .eq('user_id', context.user.id)
        .maybeSingle();

      const spreadsheetId = connectorRow?.config?.spreadsheet_id as string | undefined;
      if (!spreadsheetId) {
        return { ok: false, error: 'No spreadsheet URL was provided for this connector. Ask the user to remove and re-add the connector, pasting the Google Sheets URL this time.' };
      }

      const range = args.range || 'A1:Z100';
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      const rows = res.data.values || [];

      return {
        ok: true,
        receipt: {
          rows,
          row_count: rows.length,
          range: res.data.range,
        },
      };
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || 'Failed to read sheet';
      return { ok: false, error: `Google Sheets: ${msg}` };
    }
  },
});

export const connectorsSearchDocsTool = defineTool({
  name: 'connectors.search_docs',
  description: `Searches Google Drive for documents accessible through a Drive or Docs connector.

WHEN TO USE: user says "find the contract document", "search my drive for X", "what documents do I have about Y".

CONTRACT:
- connector_id: required. Get from connectors.list — match by name.
- query: plain text search. Searches file names and content.
- max_results: defaults to 10.
- Returns file names, types, and a short description. Never returns full file content — use this for discovery only.
- If connector is not authorized, tell the user to go to /app/connectors.

RETURNS receipt: { files[], count }. Each file: { id, name, mimeType, modifiedTime, webViewLink }.`,
  isReadOnly: true,
  inputSchema: z.object({
    connector_id: z.string().describe('The connector id from connectors.list.'),
    query: z.string().describe('Plain text search query for file names and content.'),
    max_results: z.number().optional().default(10),
  }),
  call: async (args, context) => {
    const linkedAccountId = await getConnectorLinkedAccountId(context, args.connector_id);
    if (!linkedAccountId) return { ok: false, error: 'Connector not authorized. Ask the user to go to /app/connectors and click Authorize.' };

    const auth = await getAuthorizedClient(linkedAccountId, context.supabase);
    if (!auth) return { ok: false, error: 'Could not get Google credentials for this connector.' };

    try {
      const drive = google.drive({ version: 'v3', auth });
      const res = await drive.files.list({
        q: `fullText contains '${args.query.replace(/'/g, "\\'")}' and trashed = false`,
        pageSize: Math.min(args.max_results, 20),
        fields: 'files(id, name, mimeType, modifiedTime, webViewLink)',
        orderBy: 'modifiedTime desc',
      });

      const files = (res.data.files || []).map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime,
        webViewLink: f.webViewLink,
      }));

      return { ok: true, receipt: { files, count: files.length } };
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || 'Failed to search Drive';
      return { ok: false, error: `Google Drive: ${msg}` };
    }
  },
});

export const connectorsReadDocTool = defineTool({
  name: 'connectors.read_doc',
  description: `Reads the full plain-text content of a Google Docs document connected via a Docs connector.

WHEN TO USE: user says "read my contract", "what does the document say", "summarize the doc", "check what's in [connector name]".

CONTRACT:
- connector_id: required. Get from connectors.list — match by name, pass the id.
- The connector must be a google_docs type with an authorized Google account.
- Returns the full document text. If the document is very long, summarise the key sections in your reply rather than dumping everything.
- Read-only. Never modifies the document.
- If the connector is not authorized, tell the user to go to /app/connectors to complete setup.

RETURNS receipt: { title, content, word_count }`,
  isReadOnly: true,
  inputSchema: z.object({
    connector_id: z.string().describe('The connector id from connectors.list. Match by name, pass the id.'),
  }),
  call: async (args, context) => {
    const linkedAccountId = await getConnectorLinkedAccountId(context, args.connector_id);
    if (!linkedAccountId) return { ok: false, error: 'Connector not authorized. Ask the user to go to /app/connectors and click Authorize.' };

    const auth = await getAuthorizedClient(linkedAccountId, context.supabase);
    if (!auth) return { ok: false, error: 'Could not get Google credentials for this connector.' };

    const { data: connectorRow } = await context.supabase
      .from('connectors')
      .select('config')
      .eq('id', args.connector_id)
      .eq('user_id', context.user.id)
      .maybeSingle();

    const documentId = connectorRow?.config?.document_id as string | undefined;
    if (!documentId) {
      return { ok: false, error: 'No document URL was provided for this connector. Ask the user to remove and re-add the connector, pasting the Google Docs URL this time.' };
    }

    try {
      const docs = google.docs({ version: 'v1', auth });
      const res = await docs.documents.get({ documentId });
      const doc = res.data;

      // Extract plain text from the document body
      const extractText = (elements: any[]): string => {
        return (elements || []).map((el: any) => {
          if (el.paragraph) {
            return (el.paragraph.elements || [])
              .map((e: any) => e.textRun?.content || '')
              .join('');
          }
          if (el.table) {
            return (el.table.tableRows || [])
              .map((row: any) =>
                (row.tableCells || [])
                  .map((cell: any) => extractText(cell.content || []))
                  .join('\t')
              )
              .join('\n');
          }
          return '';
        }).join('');
      };

      const content = extractText(doc.body?.content || []).trim();
      const wordCount = content.split(/\s+/).filter(Boolean).length;

      return {
        ok: true,
        receipt: {
          title: doc.title || 'Untitled',
          content: content.slice(0, 12000), // cap at ~3k words to avoid context overflow
          word_count: wordCount,
          truncated: content.length > 12000,
        },
      };
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || 'Failed to read document';
      return { ok: false, error: `Google Docs: ${msg}` };
    }
  },
});

export const connectorsSheetsAgentTool = defineTool({
  name: 'connectors.sheets_agent',
  description: `Invokes the Sheets Agent — a specialist sub-agent that reads, plans, and edits a Google Sheets connector with surgical precision.

WHEN TO USE:
- User asks to edit, update, add rows, change values, write formulas, or modify any part of a spreadsheet.
- Any write operation on a Google Sheets connector.
- User asks "update my financial sheet", "add a row to my budget", "fix the formula in column D", "clear the Q1 data".

HOW IT WORKS:
The Sheets Agent runs 3 phases automatically:
1. READ — reads the spreadsheet structure and current data
2. PLAN — decides exactly which cells/ranges to change, using Sheets API best practices
3. EXECUTE — applies changes via the Google Sheets API

CONTRACT:
- connector_id: required. Get from connectors.list, match by name.
- task: describe what to do in plain language. Include specific values, row numbers, column names if known.
- The agent handles index-safety, header preservation, formula input mode, and appending vs overwriting.
- Read-only operations (just reading data) should use connectors.read_sheet instead — this tool writes.
- CONFIRM with the user before calling if the task is ambiguous or could cause data loss.

RETURNS receipt: { summary, changes[] }`,
  isReadOnly: false,
  inputSchema: z.object({
    connector_id: z.string().describe('The connector id from connectors.list. Match by name.'),
    task: z.string().min(5).max(2000).describe('Plain-language description of what to do in the spreadsheet. Be specific about values, columns, and rows if known.'),
  }),
  call: async (args, context) => {
    const linkedAccountId = await getConnectorLinkedAccountId(context, args.connector_id);
    if (!linkedAccountId) return { ok: false, error: 'Connector not authorized. Ask the user to go to /app/connectors and click Authorize.' };

    const { data: connectorRow } = await context.supabase
      .from('connectors')
      .select('config')
      .eq('id', args.connector_id)
      .eq('user_id', context.user.id)
      .maybeSingle();

    const spreadsheetId = connectorRow?.config?.spreadsheet_id as string | undefined;
    if (!spreadsheetId) {
      return { ok: false, error: 'No spreadsheet URL configured for this connector. Ask the user to remove and re-add the connector with the Google Sheets URL.' };
    }

    const result = await runSheetsAgent({
      spreadsheetId,
      linkedAccountId,
      supabase: context.supabase,
      task: args.task,
      onProgress: context.onProgress,
    });

    if (!result.ok) return { ok: false, error: result.error };
    return {
      ok: true,
      receipt: {
        summary: result.summary,
        changes: result.changes,
        changes_count: result.changes.length,
      },
    };
  },
});

export const connectorsDocsAgentTool = defineTool({
  name: 'connectors.docs_agent',
  description: `Invokes the Docs Agent — a specialist sub-agent that reads, plans, and edits a Google Docs document with surgical precision.

WHEN TO USE:
- User asks to edit, rewrite, insert, delete, or format any part of a Google Doc.
- Any write operation on a Google Docs connector.
- User asks "update the contract", "add a section about X", "replace all instances of Y with Z", "fix the formatting of the introduction".

HOW IT WORKS:
The Docs Agent runs 3 phases automatically:
1. READ — reads the full document structure with accurate character indices
2. PLAN — decides which API operations to apply (preferring replaceAllText for targeted edits)
3. EXECUTE — applies changes via Google Docs batchUpdate API

CONTRACT:
- connector_id: required. Get from connectors.list, match by name.
- task: describe what to do. For targeted replacements, mention the exact phrase to find.
- The agent handles index-safety, operation ordering (highest-to-lowest to prevent shifts), and style preservation.
- Read-only operations should use connectors.read_doc instead — this tool writes.
- CONFIRM with the user before calling if the task could delete or overwrite significant content.

RETURNS receipt: { summary, changes[] }`,
  isReadOnly: false,
  inputSchema: z.object({
    connector_id: z.string().describe('The connector id from connectors.list. Match by name.'),
    task: z.string().min(5).max(2000).describe('Plain-language description of what to do in the document. For replacements, include the exact phrase to find.'),
  }),
  call: async (args, context) => {
    const linkedAccountId = await getConnectorLinkedAccountId(context, args.connector_id);
    if (!linkedAccountId) return { ok: false, error: 'Connector not authorized. Ask the user to go to /app/connectors and click Authorize.' };

    const { data: connectorRow } = await context.supabase
      .from('connectors')
      .select('config')
      .eq('id', args.connector_id)
      .eq('user_id', context.user.id)
      .maybeSingle();

    const documentId = connectorRow?.config?.document_id as string | undefined;
    if (!documentId) {
      return { ok: false, error: 'No document URL configured for this connector. Ask the user to remove and re-add the connector with the Google Docs URL.' };
    }

    const result = await runDocsAgent({
      documentId,
      linkedAccountId,
      supabase: context.supabase,
      task: args.task,
      onProgress: context.onProgress,
    });

    if (!result.ok) return { ok: false, error: result.error };
    return {
      ok: true,
      receipt: {
        summary: result.summary,
        changes: result.changes,
        changes_count: result.changes.length,
      },
    };
  },
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
      return { ok: true, receipt: { messages, count: messages.length } };
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
  },
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
      return { ok: true, receipt: { draft_id: draft.id, message_id: draft.messageId, status: 'draft_created' } };
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
  },
});
