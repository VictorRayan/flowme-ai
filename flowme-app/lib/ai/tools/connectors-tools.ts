import { z } from 'zod';
import { defineTool, ToolContext } from './Tool';
import { searchEmails, createDraft, readEmailMessage, GmailMessageSummary } from '@/lib/google/google-gmail';
import { google } from 'googleapis';
import { getValidGoogleToken } from '@/lib/google/google-auth';
import { runSheetsAgent } from '@/lib/ai/agents/sheets-agent';
import { runDocsAgent } from '@/lib/ai/agents/docs-agent';

type ConnectorType = 'gmail' | 'google_docs' | 'google_sheets' | 'google_drive';

type ConnectorConfig = {
  linked_account_id?: string;
  spreadsheet_id?: string;
  document_id?: string;
  folder_id?: string;
};

type ConnectorRow = {
  id?: string;
  name?: string;
  type?: ConnectorType;
  is_active?: boolean;
  config?: ConnectorConfig | null;
};

type ConnectorConnectionStatus = 'connected' | 'needs_connection' | 'needs_reconnect';

type GmailReadSelector = {
  message_id?: string;
  sender?: string;
  subject?: string;
  query?: string;
  hint?: string;
};

const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';
const GOOGLE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet';
const GOOGLE_SLIDES_MIME = 'application/vnd.google-apps.presentation';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLS_MIME = 'application/vnd.ms-excel';

const TEXT_DOWNLOAD_MIME_TYPES = new Set([
  'application/json',
  'application/xml',
  'application/xhtml+xml',
  'application/javascript',
  'application/x-javascript',
  'application/csv',
  'text/csv',
  'text/markdown',
  'text/plain',
  'text/html',
  'text/xml',
]);

const SPREADSHEET_BINARY_MIME_TYPES = new Set([XLSX_MIME, XLS_MIME]);

function configOf(row: ConnectorRow | null | undefined): ConnectorConfig {
  return row?.config || {};
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function mimeTypeForConnector(type: ConnectorType | undefined): string | null {
  if (type === 'google_docs') return GOOGLE_DOC_MIME;
  if (type === 'google_sheets') return GOOGLE_SHEET_MIME;
  return null;
}

function buildDriveSearchQuery(query: string, mimeType?: string | null): string {
  const clauses = ['trashed = false'];
  if (mimeType) {
    clauses.push(`mimeType = '${escapeDriveQueryValue(mimeType)}'`);
  }
  if (query.trim()) {
    const q = escapeDriveQueryValue(query.trim());
    clauses.push(`(name contains '${q}' or fullText contains '${q}')`);
  }
  return clauses.join(' and ');
}

function exportMimeTypeFor(mimeType: string | null | undefined): string | null {
  if (mimeType === GOOGLE_DOC_MIME) return 'text/plain';
  if (mimeType === GOOGLE_SHEET_MIME) return 'text/csv';
  if (mimeType === GOOGLE_SLIDES_MIME) return 'text/plain';
  return null;
}

function isTextDownload(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith('text/') || TEXT_DOWNLOAD_MIME_TYPES.has(mimeType);
}

function responseDataToText(data: unknown): string {
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8');
  if (data == null) return '';
  return String(data);
}

function extractGoogleFileId(value: string | null | undefined, allowRawId = false): string | undefined {
  const text = (value || '').trim();
  if (!text) return undefined;

  const urlMatch = text.match(/https?:\/\/[^\s<>"')]+/i);
  const candidate = urlMatch?.[0] || text;
  const pathMatch = candidate.match(/\/(?:document|spreadsheets|presentation|file)\/d\/([a-zA-Z0-9_-]+)/);
  if (pathMatch?.[1]) return pathMatch[1];

  const queryMatch = candidate.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryMatch?.[1]) return queryMatch[1];

  if (allowRawId && /^[a-zA-Z0-9_-]{3,}$/.test(candidate) && !/[\s/]/.test(candidate)) return candidate;
  return undefined;
}

function naturalNameFrom(value: string | null | undefined): string | undefined {
  const text = (value || '').trim();
  if (!text || extractGoogleFileId(text, true)) return undefined;
  return text;
}

function isGenericSpreadsheetConnectorName(value: string | null | undefined): boolean {
  const normalized = (value || '').trim().toLowerCase();
  return !normalized || ['google sheets', 'sheets', 'planilhas', 'google planilhas'].includes(normalized);
}

function normalizeLookupText(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@._+-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function quoteGmailSearchTerm(value: string): string {
  return `"${value.trim().replace(/["\\]/g, ' ')}"`;
}

function buildGmailReadQuery(args: GmailReadSelector): string {
  const explicitQuery = args.query?.trim();
  if (explicitQuery) return explicitQuery;

  const parts: string[] = [];
  const sender = args.sender?.trim();
  const subject = args.subject?.trim();
  const hint = args.hint?.trim();

  if (sender) parts.push(quoteGmailSearchTerm(sender));
  if (subject) parts.push(`subject:${quoteGmailSearchTerm(subject)}`);
  if (!sender && !subject && hint) parts.push(hint);

  return parts.join(' ').trim();
}

function scoreGmailCandidate(message: GmailMessageSummary, args: GmailReadSelector): number {
  const from = normalizeLookupText(message.from);
  const subject = normalizeLookupText(message.subject);
  const snippet = normalizeLookupText(message.snippet);
  const sender = normalizeLookupText(args.sender);
  const requestedSubject = normalizeLookupText(args.subject);
  const hint = normalizeLookupText(args.hint || args.query);

  let score = 0;
  if (sender && from.includes(sender)) score += 8;
  if (requestedSubject && subject === requestedSubject) score += 12;
  else if (requestedSubject && subject.includes(requestedSubject)) score += 10;
  else if (requestedSubject && requestedSubject.includes(subject)) score += 6;
  if (hint && (subject.includes(hint) || from.includes(hint) || snippet.includes(hint))) score += 3;
  return score;
}

function pickGmailCandidate(messages: GmailMessageSummary[], args: GmailReadSelector): { selected: GmailMessageSummary | null; ambiguous: GmailMessageSummary[] } {
  if (messages.length === 0) return { selected: null, ambiguous: [] };

  const scored = messages
    .map((message, index) => ({ message, score: scoreGmailCandidate(message, args), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const top = scored[0];
  if ((args.sender || args.subject || args.hint) && top.score === 0) {
    return { selected: null, ambiguous: messages.slice(0, 5) };
  }

  const subjectRequested = Boolean(args.subject?.trim());
  const hasTie = scored.length > 1 && scored[1].score === top.score && top.score > 0;
  if (!subjectRequested && hasTie) {
    return { selected: null, ambiguous: scored.filter((item) => item.score === top.score).map((item) => item.message).slice(0, 5) };
  }

  return { selected: top.message, ambiguous: [] };
}

async function findDriveFileByNaturalName(
  auth: any,
  connectorType: ConnectorType | undefined,
  naturalName: string | undefined,
): Promise<{ id: string; name?: string | null } | null> {
  const query = naturalName?.trim();
  if (!query) return null;

  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.list({
    q: buildDriveSearchQuery(query, mimeTypeForConnector(connectorType)),
    pageSize: 10,
    fields: 'files(id, name, mimeType, modifiedTime, webViewLink)',
    orderBy: 'modifiedTime desc',
  });
  const files = res.data.files || [];
  const exact = files.find((file) => (file.name || '').trim().toLowerCase() === query.toLowerCase());
  const selected = exact || files[0];
  return selected?.id ? { id: selected.id, name: selected.name } : null;
}

async function getConnectorRow(
  context: ToolContext,
  connectorId?: string,
): Promise<ConnectorRow | null> {
  if (!connectorId) return null;
  const { data } = await context.supabase
    .from('connectors')
    .select('id, name, type, config, is_active')
    .eq('id', connectorId)
    .eq('user_id', context.user.id)
    .maybeSingle();
  return data || null;
}

async function findConnectorByType(
  context: ToolContext,
  type: ConnectorType,
): Promise<ConnectorRow | null> {
  const { data } = await context.supabase
    .from('connectors')
    .select('id, name, type, config, is_active')
    .eq('user_id', context.user.id)
    .eq('type', type)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data || null;
}

async function getConnectorRowWithFallback(
  context: ToolContext,
  connectorId?: string,
  preferredType?: ConnectorType,
  strictPreferred = false,
): Promise<ConnectorRow | null> {
  if (connectorId) {
    const connector = await getConnectorRow(context, connectorId);
    if (connector?.is_active && configOf(connector).linked_account_id) {
      return connector;
    }
  }
  if (preferredType) {
    const preferred = await findConnectorByType(context, preferredType);
    if (preferred) return preferred;
    if (strictPreferred) return null;
  }
  for (const type of ['google_sheets', 'google_docs', 'google_drive'] as ConnectorType[]) {
    const c = await findConnectorByType(context, type);
    if (c) return c;
  }
  return null;
}

async function getConnectorRowForTool(
  context: ToolContext,
  connectorId: string | undefined,
  expectedType: ConnectorType,
): Promise<ConnectorRow | null> {
  return getConnectorRowWithFallback(context, connectorId, expectedType);
}

/* ── helpers ── */

async function getGoogleAccountId(context: ToolContext): Promise<string | null> {
  // Prefer an connected Gmail connector over a generic linked account
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

async function getConnectedClient(linkedAccountId: string, context: ToolContext) {
  try {
    return await getValidGoogleToken(linkedAccountId, { supabase: context.supabase, user: context.user });
  } catch (error) {
    console.error('[connectors] Google credential refresh failed:', error);
    return null;
  }
}

async function resolveConnectorConnectionStatus(
  connector: ConnectorRow,
  context: ToolContext,
): Promise<ConnectorConnectionStatus> {
  const linkedAccountId = configOf(connector).linked_account_id;
  if (!connector.is_active || !linkedAccountId) return 'needs_connection';
  const client = await getConnectedClient(linkedAccountId, context);
  return client ? 'connected' : 'needs_reconnect';
}

async function getConnectorLinkedAccountId(
  context: ToolContext,
  connectorId?: string,
): Promise<string | null> {
  const connector = await getConnectorRowWithFallback(context, connectorId);
  return connector ? (configOf(connector).linked_account_id || null) : null;
}

async function getConnectorLinkedAccountIdForTool(
  context: ToolContext,
  connectorId: string | undefined,
  expectedType: ConnectorType,
): Promise<{ connector: ConnectorRow | null; linkedAccountId: string | null }> {
  const connector = await getConnectorRowForTool(context, connectorId, expectedType);
  const linkedAccountId = configOf(connector).linked_account_id || null;
  return { connector, linkedAccountId };
}

async function readSpreadsheetBinaryAsCsv(
  drive: ReturnType<typeof google.drive>,
  fileId: string,
): Promise<string> {
  const { default: ExcelJS } = await import('exceljs');
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' },
  );
  const buffer = Buffer.isBuffer(res.data)
    ? res.data
    : res.data instanceof ArrayBuffer
      ? Buffer.from(res.data)
      : Buffer.from(res.data as any);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sections: string[] = [];
  workbook.eachSheet((worksheet) => {
    const rows: string[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        const value = cell.value;
        let text = '';
        if (value == null) text = '';
        else if (typeof value === 'object' && 'text' in (value as any)) text = String((value as any).text ?? '');
        else if (typeof value === 'object' && 'result' in (value as any)) text = String((value as any).result ?? '');
        else if (typeof value === 'object' && value instanceof Date) text = value.toISOString();
        else text = String(value);
        cells.push(text.includes(',') || text.includes('"') || text.includes('\n')
          ? `"${text.replace(/"/g, '""')}"`
          : text);
      });
      rows.push(cells.join(','));
    });
    if (rows.length > 0) {
      sections.push(`# Sheet: ${worksheet.name}\n${rows.join('\n')}`);
    }
  });

  return sections.join('\n\n');
}

async function readDriveFileText(
  drive: ReturnType<typeof google.drive>,
  fileId: string,
  mimeType: string | null | undefined,
): Promise<{ content: string; readable: true } | { error: string; readable: false }> {
  const exportMime = exportMimeTypeFor(mimeType);
  if (exportMime) {
    const res = await drive.files.export(
      { fileId, mimeType: exportMime },
      { responseType: 'arraybuffer' },
    );
    return { readable: true, content: responseDataToText(res.data) };
  }

  if (mimeType && SPREADSHEET_BINARY_MIME_TYPES.has(mimeType)) {
    try {
      const content = await readSpreadsheetBinaryAsCsv(drive, fileId);
      return { readable: true, content };
    } catch (e: any) {
      return {
        readable: false,
        error: `Could not parse the spreadsheet contents: ${e?.message || 'unknown error'}.`,
      };
    }
  }

  if (isTextDownload(mimeType)) {
    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' },
    );
    return { readable: true, content: responseDataToText(res.data) };
  }

  return {
    readable: false,
    error: 'This Drive file is not text-readable yet. Use Google Docs, Sheets, CSV, JSON, Markdown, HTML, XML, or plain text files.',
  };
}

function extractGoogleDocPlainText(elements: any[]): string {
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
            .map((cell: any) => extractGoogleDocPlainText(cell.content || []))
            .join('\t')
        )
        .join('\n');
    }
    return '';
  }).join('');
}

/* ── tools ── */

export const connectorsListTool = defineTool({
  name: 'connectors.list',
  description: `Lists all connectors the user has added, including their connection status.

WHEN TO USE: user asks "what's connected", "do I have Gmail linked", "which sources can you access"; or before using a connector tool to verify it is connected.

CONTRACT:
- Read-only. Returns connectors from the Connectors page (not just linked Google accounts).
- Each connector has: id, name, type, connection_status, is_connected, is_active.
- connection_status is the source of truth:
  - connected: Balys verified Google credentials and can read it.
  - needs_connection: the user added the connector but has not connected the Google account yet.
  - needs_reconnect: the connector points to a Google account, but the token is missing or cannot refresh.
- Never say a connector is connected unless connection_status is "connected".
- Surface disconnected connectors as "needs connection" to the user. Tell them to open Connectors and click Connect account.
- Surface needs_reconnect as a backend connection problem. Tell the user the Google connection did not complete correctly and ask them to reconnect the source.
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

    const result = await Promise.all((connectors || []).map(async (c: any) => {
      const connectionStatus = await resolveConnectorConnectionStatus(c, context);
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        is_active: c.is_active,
        is_connected: connectionStatus === 'connected',
        connection_status: connectionStatus,
      };
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
- file_id can be a spreadsheet id from discovery, a full Google Sheets URL, or the natural spreadsheet name the user typed.
- spreadsheet_name is a user-facing title like "Finance 2026". Use it when the user names the sheet instead of giving a link.
- range: A1 notation, e.g. "Sheet1!A1:D20". Defaults to first 100 rows if omitted.
- Returns rows as arrays of cell values. Empty cells are empty strings.
- Read-only. Never modifies the sheet.
- Never ask the user for a spreadsheet ID. Resolve titles internally with Drive search, then read the selected spreadsheet.
- If the connector is not connected, tell the user to open Connectors and click Connect account for this source.

RETURNS receipt: { rows, row_count, range, spreadsheet_title }`,
  isReadOnly: true,
  inputSchema: z.object({
    connector_id: z.string().optional().describe('The connector id from connectors.list. Match by name, pass the id.'),
    file_id: z.string().optional().describe('Spreadsheet id returned by connectors.search_docs, full Google Sheets URL, or natural spreadsheet title/name. Resolve internally; never ask the user for it.'),
    spreadsheet_url: z.string().optional().describe('Full Google Sheets URL pasted by the user.'),
    spreadsheet_name: z.string().optional().describe('Natural spreadsheet title/name, such as "Finance 2026". Use this instead of asking for a file id.'),
    range: z.string().optional().describe('A1 notation range, e.g. "Sheet1!A1:D50". Omit for first 100 rows of default sheet.'),
  }),
  call: async (args, context) => {
    const { connector, linkedAccountId } = await getConnectorLinkedAccountIdForTool(context, args.connector_id, 'google_sheets');
    const config = configOf(connector);
    if (!linkedAccountId) return { ok: false, error: 'Connector needs connection. Ask the user to open Connectors and click Connect account for this source.' };

    const auth = await getConnectedClient(linkedAccountId, context);
    if (!auth) return { ok: false, error: 'Google connection needs refresh. Ask the user to open Connectors and click Reconnect account for this source.' };

    try {
      const sheets = google.sheets({ version: 'v4', auth });

      let spreadsheetTitle: string | undefined;
      let spreadsheetId = extractGoogleFileId(args.file_id, true) || extractGoogleFileId(args.spreadsheet_url) || extractGoogleFileId(config.spreadsheet_id, true);
      if (!spreadsheetId) {
        const naturalName = args.spreadsheet_name
          || naturalNameFrom(args.file_id)
          || (!isGenericSpreadsheetConnectorName(connector?.name) ? connector?.name : undefined);
        const found = await findDriveFileByNaturalName(auth, connector?.type, naturalName);
        spreadsheetId = found?.id;
        spreadsheetTitle = found?.name || naturalName;
      }
      if (!spreadsheetId) {
        return { ok: false, error: 'I could not identify which spreadsheet to read. Search spreadsheets by name first, then read the matching result.' };
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
          spreadsheet_title: spreadsheetTitle,
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
  description: `Discovers files through a Google Drive, Docs, or Sheets connector.

WHEN TO USE: user says "find the contract document", "search my drive for X", "what documents do I have about Y", "list my docs", "quais documentos tenho", or wants to choose a file before reading or editing.

CONTRACT:
- connector_id: required. Get from connectors.list — match by name.
- query: optional plain text search. Searches file names and content where Drive supports it. Empty query lists recent files.
- max_results: defaults to 10.
- Google Docs connectors list Google Docs files; Google Sheets connectors list spreadsheets; Google Drive connectors list Drive files.
- Returns file names and types only. Use this for discovery, then call a read/edit tool on the selected file.
- If the user provided a Google Docs URL or a clear document title to read, prefer connectors.find_and_read_doc instead of only listing.
- If connector is not connected, tell the user to open Connectors and click Connect account for this source.

RETURNS receipt: { files[], count }. Each file: { id, name, mimeType, modifiedTime, webViewLink }.`,
  isReadOnly: true,
  inputSchema: z.object({
    connector_id: z.string().optional().describe('The connector id from connectors.list.'),
    connector_type: z.enum(['google_drive', 'google_docs', 'google_sheets']).optional().describe('Preferred connector type for discovery. Use google_docs for Docs, google_sheets for Sheets, and google_drive for broad Drive.'),
    query: z.string().optional().default('').describe('Plain text search query for file names and content. Omit to list recent files.'),
    max_results: z.number().optional().default(10),
  }),
  call: async (args, context) => {
    const connector = await getConnectorRowWithFallback(
      context,
      args.connector_id,
      args.connector_type || (context.preferredConnectorType && context.preferredConnectorType !== 'gmail' ? context.preferredConnectorType : undefined),
      Boolean(args.connector_type || (context.preferredConnectorType && context.preferredConnectorType !== 'gmail')),
    );
    const searchQuery = args.query ?? '';
    const linkedAccountId = connector ? (configOf(connector).linked_account_id || null) : null;
    if (!linkedAccountId) return { ok: false, error: 'Connector needs connection. Ask the user to open Connectors and click Connect account for this source.' };

    const auth = await getConnectedClient(linkedAccountId, context);
    if (!auth) return { ok: false, error: 'Google connection needs refresh. Ask the user to open Connectors and click Reconnect account for this source.' };

    try {
      const drive = google.drive({ version: 'v3', auth });
      const res = await drive.files.list({
        q: buildDriveSearchQuery(searchQuery, mimeTypeForConnector(connector?.type)),
        pageSize: Math.min(args.max_results ?? 10, 20),
        fields: 'files(id, name, mimeType, modifiedTime, webViewLink, size)',
        orderBy: 'modifiedTime desc',
      });

      const files = (res.data.files || []).map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        modifiedTime: f.modifiedTime,
        webViewLink: f.webViewLink,
        size: f.size,
      }));

      return { ok: true, receipt: { files, count: files.length, connector_type: connector?.type } };
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || 'Failed to search Drive';
      return { ok: false, error: `Google Drive: ${msg}` };
    }
  },
});

export const connectorsReadDriveFileTool = defineTool({
  name: 'connectors.read_drive_file',
  description: `Reads the text content of a file selected from Drive discovery.

WHEN TO USE: after connectors.search_docs returns candidate files and the user asks to open, read, summarize, compare, or extract insights from one of them.

CONTRACT:
- connector_id: required. Use the same connector used for discovery.
- file_id or file_url: required. Get it from connectors.search_docs results or from a Google Docs/Sheets/Drive URL the user pasted; never ask the user for the ID.
- Supports Google Docs, Google Sheets previews, Google Slides text export, CSV, JSON, Markdown, HTML, XML, and plain text files.
- For Google Sheets, this returns a CSV preview from Drive export. For precise ranges or edits, use connectors.read_sheet or connectors.sheets_agent with a Sheets connector.
- Read-only. Never modifies the file.
- Do not dump raw content unless the user explicitly asks; summarize or extract insights in natural language.

RETURNS receipt: { title, mimeType, content, character_count, truncated, webViewLink }`,
  isReadOnly: true,
  inputSchema: z.object({
    connector_id: z.string().optional().describe('The connector id from connectors.list or the discovery tool.'),
    file_id: z.string().optional().describe('The file id returned by connectors.search_docs, or the full Google file URL pasted by the user. Resolve internally; never ask the user for this.'),
    file_url: z.string().optional().describe('Full Google Docs, Sheets, Slides, or Drive file URL pasted by the user.'),
    max_chars: z.number().optional().default(12000).describe('Maximum characters of text to return. Default 12000.'),
  }),
  call: async (args, context) => {
    const linkedAccountId = await getConnectorLinkedAccountId(context, args.connector_id);
    if (!linkedAccountId) return { ok: false, error: 'Connector needs connection. Ask the user to open Connectors and click Connect account for this source.' };

    const auth = await getConnectedClient(linkedAccountId, context);
    if (!auth) return { ok: false, error: 'Google connection needs refresh. Ask the user to open Connectors and click Reconnect account for this source.' };

    try {
      const fileId = extractGoogleFileId(args.file_id, true) || extractGoogleFileId(args.file_url);
      if (!fileId) return { ok: false, error: 'No file selected. Pass a Google file URL or select a file from connectors.search_docs first.' };

      const drive = google.drive({ version: 'v3', auth });
      const metaRes = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, modifiedTime, webViewLink, size, parents',
      });
      const file = metaRes.data;

      const read = await readDriveFileText(drive, fileId, file.mimeType);
      if (!read.readable) return { ok: false, error: read.error };

      const maxChars = Math.max(1, Math.min(args.max_chars ?? 12000, 30000));
      const content = read.content.slice(0, maxChars);

      return {
        ok: true,
        receipt: {
          title: file.name || 'Untitled',
          mimeType: file.mimeType,
          modifiedTime: file.modifiedTime,
          webViewLink: file.webViewLink,
          content,
          character_count: read.content.length,
          truncated: read.content.length > maxChars,
        },
      };
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || 'Failed to read Drive file';
      return { ok: false, error: `Google Drive: ${msg}` };
    }
  },
});

export const connectorsReadDocTool = defineTool({
  name: 'connectors.read_doc',
  description: `Reads the full plain-text content of a Google Docs document connected via a Docs connector.

WHEN TO USE: user says "read my contract", "what does the document say", "summarize the doc", "check what's in [connector name]", or pastes a Google Docs URL and asks you to read it.

CONTRACT:
- connector_id: required. Get from connectors.list — match by name, pass the id.
- file_id or document_url can be a document id from discovery or a full Google Docs URL pasted by the user.
- The connector must be a google_docs type connected to a Google account.
- Returns the full document text. If the document is very long, summarise the key sections in your reply rather than dumping everything.
- Read-only. Never modifies the document.
- If the connector is not connected, tell the user to open Connectors and click Connect account for this source.

RETURNS receipt: { title, content, word_count }`,
  isReadOnly: true,
  inputSchema: z.object({
    connector_id: z.string().optional().describe('The connector id from connectors.list. Match by name, pass the id.'),
    file_id: z.string().optional().describe('Document file id returned by connectors.search_docs, or the full Google Docs URL pasted by the user. Resolve internally; never ask the user for it.'),
    document_url: z.string().optional().describe('Full Google Docs URL pasted by the user.'),
  }),
  call: async (args, context) => {
    const connector = await getConnectorRowWithFallback(context, args.connector_id, 'google_docs');
    const linkedAccountId = connector ? (configOf(connector).linked_account_id || null) : null;
    if (!linkedAccountId) return { ok: false, error: 'Connector needs connection. Ask the user to open Connectors and click Connect account for this source.' };

    const auth = await getConnectedClient(linkedAccountId, context);
    if (!auth) return { ok: false, error: 'Google connection needs refresh. Ask the user to open Connectors and click Reconnect account for this source.' };

    const documentId = extractGoogleFileId(args.file_id, true) || extractGoogleFileId(args.document_url) || extractGoogleFileId(configOf(connector)?.document_id, true);
    if (!documentId) {
      return { ok: false, error: 'No document selected. Pass a Google Docs URL or search documents first with connectors.search_docs, then read the selected file.' };
    }

    try {
      const docs = google.docs({ version: 'v1', auth });
      const res = await docs.documents.get({ documentId });
      const doc = res.data;

      const content = extractGoogleDocPlainText(doc.body?.content || []).trim();
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

export const connectorsFindAndReadDocTool = defineTool({
  name: 'connectors.find_and_read_doc',
  description: `Finds a Google Docs document by natural name or reads it directly from a pasted Google Docs URL, then returns its plain-text content.

WHEN TO USE:
- User says "read the document called X", "open X", "what is in X", "leia o documento X", or "o que tem em X".
- User pasted a Google Docs URL and asks to read, summarize, understand, or decide where to edit.
- User expects the connector to be intuitive and does not know file IDs.

CONTRACT:
- connector_id: required. Get from connectors.list, match by name.
- name_or_url: user-facing document name/title or full Google Docs URL.
- If name_or_url is a URL, extract the document ID and read directly.
- If name_or_url is a name, search Google Drive for Google Docs files, choose the exact title match first, otherwise the top relevant result.
- Never ask the user for a document ID.
- Read-only. For edits after reading, use connectors.docs_agent with the same URL/name resolved to file_id.

RETURNS receipt: { title, document_id, content, word_count, matched_by, candidates[] }. document_id is internal; never show it to the user.`,
  isReadOnly: true,
  inputSchema: z.object({
    connector_id: z.string().optional().describe('The connector id from connectors.list. Match by name, pass the id.'),
    name_or_url: z.string().min(1).describe('Natural document title/name or full Google Docs URL pasted by the user.'),
    max_chars: z.number().optional().default(12000).describe('Maximum characters of text to return. Default 12000.'),
  }),
  call: async (args, context) => {
    const linkedAccountId = await getConnectorLinkedAccountId(context, args.connector_id);
    if (!linkedAccountId) return { ok: false, error: 'Connector needs connection. Ask the user to open Connectors and click Connect account for this source.' };

    const auth = await getConnectedClient(linkedAccountId, context);
    if (!auth) return { ok: false, error: 'Google connection needs refresh. Ask the user to open Connectors and click Reconnect account for this source.' };

    try {
      const docs = google.docs({ version: 'v1', auth });
      const drive = google.drive({ version: 'v3', auth });
      const directDocumentId = extractGoogleFileId(args.name_or_url);
      let documentId = directDocumentId;
      let matchedBy: 'url' | 'exact_name' | 'search_top_result' = directDocumentId ? 'url' : 'search_top_result';
      let candidates: Array<{ id?: string | null; name?: string | null; modifiedTime?: string | null; webViewLink?: string | null }> = [];

      if (!documentId) {
        const searchText = args.name_or_url.trim();
        const res = await drive.files.list({
          q: buildDriveSearchQuery(searchText, GOOGLE_DOC_MIME),
          pageSize: 10,
          fields: 'files(id, name, mimeType, modifiedTime, webViewLink)',
          orderBy: 'modifiedTime desc',
        });
        candidates = res.data.files || [];
        const exact = candidates.find((file) => (file.name || '').trim().toLowerCase() === searchText.toLowerCase());
        const selected = exact || candidates[0];
        if (!selected?.id) {
          return { ok: false, error: `No Google Doc found matching "${searchText}".` };
        }
        documentId = selected.id;
        matchedBy = exact ? 'exact_name' : 'search_top_result';
      }

      const docRes = await docs.documents.get({ documentId });
      const doc = docRes.data;
      const fullContent = extractGoogleDocPlainText(doc.body?.content || []).trim();
      const maxChars = Math.max(1, Math.min(args.max_chars ?? 12000, 30000));
      const content = fullContent.slice(0, maxChars);
      const wordCount = fullContent.split(/\s+/).filter(Boolean).length;

      return {
        ok: true,
        receipt: {
          title: doc.title || 'Untitled',
          document_id: documentId,
          content,
          word_count: wordCount,
          truncated: fullContent.length > maxChars,
          matched_by: matchedBy,
          candidates: candidates.slice(0, 5).map((file) => ({
            id: file.id,
            name: file.name,
            modifiedTime: file.modifiedTime,
            webViewLink: file.webViewLink,
          })),
        },
      };
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || 'Failed to find and read document';
      return { ok: false, error: `Google Docs: ${msg}` };
    }
  },
});

export const connectorsCreateDocTool = defineTool({
  name: 'connectors.create_doc',
  description: `Creates a new Google Docs document in the connected Google account and writes initial content into it.

WHEN TO USE:
- User asks Balys to write, draft, create, generate, or montar a new Google Doc.
- User asks for a document such as a proposal, memo, policy, plan, brief, letter, contract draft, meeting summary, or report.
- User selected /docs and asked for new content instead of reading an existing file.

HOW IT WORKS:
1. Use connectors.list to find a connected Google Docs connector.
2. Draft the content in the user's requested language using the Google Docs Editorial Agent standards.
3. Call this tool with a clear title and polished initial content.

CONTRACT:
- connector_id: required. Get from connectors.list, match by name.
- title: user-facing document title. Do not use a URL or ID.
- content: plain text initial body. Use clear headings and paragraphs; Google Docs will receive it as editable text.
- This creates a new document. For edits to an existing document, use connectors.docs_agent.
- Never expose document_id to the user; it is only for internal follow-up.

RETURNS receipt: { title, document_id, webViewLink, character_count, status }.`,
  isReadOnly: false,
  inputSchema: z.object({
    connector_id: z.string().optional().describe('The connector id from connectors.list. Match by name.'),
    title: z.string().min(1).max(200).describe('The Google Doc title to create.'),
    content: z.string().min(1).max(30000).describe('Initial plain-text document content in the user requested language.'),
  }),
  call: async (args, context) => {
    const linkedAccountId = await getConnectorLinkedAccountId(context, args.connector_id);
    if (!linkedAccountId) return { ok: false, error: 'Connector needs connection. Ask the user to open Connectors and click Connect account for this source.' };

    const auth = await getConnectedClient(linkedAccountId, context);
    if (!auth) return { ok: false, error: 'Google connection needs refresh. Ask the user to open Connectors and click Reconnect account for this source.' };

    try {
      const docs = google.docs({ version: 'v1', auth });
      const title = args.title.trim();
      const content = args.content.trimEnd();
      const createRes = await docs.documents.create({ requestBody: { title } });
      const documentId = createRes.data.documentId;
      if (!documentId) return { ok: false, error: 'Google Docs did not return a document id.' };

      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: content.endsWith('\n') ? content : `${content}\n`,
              },
            },
          ],
        },
      });

      return {
        ok: true,
        receipt: {
          title,
          document_id: documentId,
          webViewLink: `https://docs.google.com/document/d/${documentId}/edit`,
          character_count: content.length,
          status: 'created',
        },
      };
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || 'Failed to create document';
      return { ok: false, error: `Google Docs: ${msg}` };
    }
  },
});

export const connectorsSheetsAgentTool = defineTool({
  name: 'connectors.sheets_agent',
  description: `Invokes the Google Sheets Financial Economist Agent — a specialist sub-agent that reads spreadsheet context, generates financial insights, plans formulas, and edits Google Sheets with precision.

WHEN TO USE:
- User asks for financial insight, spending analysis, budget diagnosis, trend analysis, variance analysis, forecast help, or recommendations based on a spreadsheet.
- User asks to edit, update, add rows, change values, write formulas, or modify any part of a spreadsheet.
- Any write operation on a Google Sheets connector.
- User asks "what insights do you see in my expenses?", "analyze my financial sheet", "update my financial sheet", "add a row to my budget", "fix the formula in column D", "clear the Q1 data".

HOW IT WORKS:
The Financial Economist Agent runs 3 phases automatically:
1. READ — reads spreadsheet structure, rows, layout, and financial context
2. PLAN — decides whether this is insight-only or requires cell operations
3. EXECUTE — applies changes via the Google Sheets API only when write operations are needed

CONTRACT:
- connector_id: required. Get from connectors.list, match by name.
- file_id can be an internal id, a pasted Google Sheets URL, or the natural spreadsheet name/title the user typed.
- spreadsheet_name is a user-facing title like "Finance 2026". Prefer this over asking the user for any technical identifier.
- task: describe what to do in plain language. Include specific values, row numbers, column names if known.
- mode: use "analyze" for insights only, "edit" for requested writes, or omit for auto.
- The agent handles layout, formatting intent, header preservation, formula input mode, and appending vs overwriting.
- For financial insight requests, this tool should return insights without modifying the sheet.
- Never ask the user for a spreadsheet ID. Resolve named spreadsheets internally with Drive search, then run the agent.
- CONFIRM with the user before calling if the task is ambiguous or could cause data loss.

RETURNS receipt: { summary, changes[], insights[] }`,
  isReadOnly: false,
  inputSchema: z.object({
    connector_id: z.string().optional().describe('The connector id from connectors.list. Match by name.'),
    file_id: z.string().optional().describe('Spreadsheet id returned by connectors.search_docs, full Google Sheets URL, or natural spreadsheet title/name. Resolve internally; never ask the user for it.'),
    spreadsheet_name: z.string().optional().describe('Natural spreadsheet title/name, such as "Finance 2026". Use this instead of asking for a file id.'),
    task: z.string().min(5).max(2000).describe('Plain-language description of what to do in the spreadsheet. Be specific about values, columns, and rows if known.'),
    mode: z.enum(['auto', 'analyze', 'edit']).optional().default('auto').describe('Use analyze for insights only, edit for sheet changes, auto when uncertain.'),
  }),
  call: async (args, context) => {
    const { connector: connectorRow, linkedAccountId } = await getConnectorLinkedAccountIdForTool(context, args.connector_id, 'google_sheets');
    if (!linkedAccountId) return { ok: false, error: 'Connector needs connection. Ask the user to open Connectors and click Connect account for this source.' };
    const auth = await getConnectedClient(linkedAccountId, context);
    if (!auth) return { ok: false, error: 'Google connection needs refresh. Ask the user to open Connectors and click Reconnect account for this source.' };

    const config = configOf(connectorRow);
    let spreadsheetId = extractGoogleFileId(args.file_id, true) || extractGoogleFileId(args.task) || extractGoogleFileId(config.spreadsheet_id, true);
    if (!spreadsheetId) {
      const naturalName = args.spreadsheet_name
        || naturalNameFrom(args.file_id)
        || (!isGenericSpreadsheetConnectorName(connectorRow?.name) ? connectorRow?.name : undefined);
      const found = await findDriveFileByNaturalName(auth, connectorRow?.type, naturalName);
      spreadsheetId = found?.id;
    }
    if (!spreadsheetId) {
      return { ok: false, error: 'I could not identify which spreadsheet to use. Search spreadsheets by name first, then use the matching result.' };
    }

    const result = await runSheetsAgent({
      spreadsheetId,
      linkedAccountId,
      supabase: context.supabase,
      task: args.task,
      mode: args.mode,
      onProgress: context.onProgress,
    });

    if (!result.ok) return { ok: false, error: result.error };
    return {
      ok: true,
      receipt: {
        summary: result.summary,
        changes: result.changes,
        changes_count: result.changes.length,
        insights: result.insights || [],
        insights_count: result.insights?.length || 0,
      },
    };
  },
});

export const connectorsDocsAgentTool = defineTool({
  name: 'connectors.docs_agent',
  description: `Invokes the Google Docs Editorial Agent — a senior editor and Google Docs API specialist that reads, plans, writes, rewrites, structures, formats, and edits an existing Google Doc with precision.

WHEN TO USE:
- User asks to write, draft, insert, expand, summarize into, restructure, format, or improve content inside an existing Google Doc.
- User asks to edit, rewrite, insert, delete, or format any part of a Google Doc.
- Any write operation on a Google Docs connector.
- User asks "update the contract", "add a section about X", "replace all instances of Y with Z", "fix the formatting of the introduction".

HOW IT WORKS:
The Editorial Agent runs 3 phases automatically:
1. READ — reads the full document structure with accurate character indices
2. PLAN — decides which API operations to apply (preferring replaceAllText for targeted edits)
3. EXECUTE — applies changes via Google Docs batchUpdate API

CONTRACT:
- connector_id: required. Get from connectors.list, match by name.
- task: describe what to do. For targeted replacements, mention the exact phrase to find.
- The agent handles editorial quality, document structure, index-safety, operation ordering (highest-to-lowest to prevent shifts), and style preservation.
- For a brand-new document, use connectors.create_doc. For existing document edits, use this tool.
- Read-only operations should use connectors.read_doc instead — this tool writes.
- CONFIRM with the user before calling if the task could delete or overwrite significant content.

RETURNS receipt: { summary, changes[] }`,
  isReadOnly: false,
  inputSchema: z.object({
    connector_id: z.string().optional().describe('The connector id from connectors.list. Match by name.'),
    file_id: z.string().optional().describe('Document file id returned by connectors.search_docs, or the full Google Docs URL pasted by the user. Resolve internally; never ask the user for it.'),
    document_url: z.string().optional().describe('Full Google Docs URL pasted by the user.'),
    task: z.string().min(5).max(2000).describe('Plain-language description of what to do in the document. For replacements, include the exact phrase to find.'),
  }),
  call: async (args, context) => {
    const connector = await getConnectorRowWithFallback(context, args.connector_id, 'google_docs');
    const linkedAccountId = connector ? (configOf(connector).linked_account_id || null) : null;
    if (!linkedAccountId) return { ok: false, error: 'Connector needs connection. Ask the user to open Connectors and click Connect account for this source.' };
    const auth = await getConnectedClient(linkedAccountId, context);
    if (!auth) return { ok: false, error: 'Google connection needs refresh. Ask the user to open Connectors and click Reconnect account for this source.' };

    const documentId = extractGoogleFileId(args.file_id, true) || extractGoogleFileId(args.document_url) || extractGoogleFileId(args.task) || extractGoogleFileId(configOf(connector)?.document_id, true);
    if (!documentId) {
      return { ok: false, error: 'No document selected. Pass a Google Docs URL or search documents first with connectors.search_docs, then edit the selected file.' };
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

DO NOT USE: when the user asks about a message that was already listed in this conversation, like "what is in the Pedro Sobral one?" or quotes a subject you already showed. In that case call gmail.read_message with the known message_id if available, or with natural sender/subject fields so the tool resolves and opens the message.

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
    query: z.string().optional().default('in:inbox').describe('Gmail search expression. Supports operators (from:, to:, subject:, is:unread, has:attachment, after:YYYY/MM/DD, label:…) and free-text. Translate relative dates to absolute. Defaults to in:inbox.'),
    max_results: z.number().optional().default(10).describe('Cap on returned messages. Default 10. Keep small — each result triggers a metadata fetch.'),
  }),
  call: async (args, context) => {
    const accountId = await getGoogleAccountId(context);
    if (!accountId) return { ok: false, error: 'No active Google account connected.' };
    try {
      const messages = await searchEmails(accountId, args.query, args.max_results, context);
      return { ok: true, receipt: { messages, count: messages.length } };
    } catch (e: any) {
      const googleMsg = e?.response?.data?.error?.message || e?.errors?.[0]?.message || e?.message;
      const errCode = e?.response?.data?.error?.code || e?.code;
      const status = e?.response?.data?.error?.status;
      let detailedError = errCode && googleMsg ? `Google API ${errCode}: ${googleMsg}` : (googleMsg || 'Failed to search Gmail');
      if (errCode === 401 || errCode === 403 || status === 'PERMISSION_DENIED' || /scope|consent|authoriz/i.test(googleMsg || '')) {
        detailedError = `Gmail connection needs refresh. Ask the user to open Connectors and click Reconnect account.`;
      }
      console.error('[gmail.search_messages] Google API error:', { errCode, status, googleMsg });
      return { ok: false, error: detailedError };
    }
  },
});

export const gmailReadMessageTool = defineTool({
  name: 'gmail.read_message',
  description: `Reads the full body of a selected Gmail message. Read-only — does not mark, archive, reply, or modify anything.

WHEN TO USE: after gmail.search_messages returns candidate messages and the user asks what an email says, why someone replied, what the main point is, or asks for a reply based on a specific email. Also use this directly for follow-ups that refer to a message you just listed, even if you only have the sender or subject in conversation context.

CONTRACT:
- message_id is the internal Gmail id from gmail.search_messages. Never ask the user for it and never show it.
- If message_id is not available, pass sender, subject, query, or hint from the user's natural language or from the previous visible search result. The tool will search and resolve the best matching message internally before reading.
- If the user quotes your previous list item, extract the sender and subject from that quote and call this tool. Do not run a narrower search that can contradict the previous result.
- If multiple messages are genuinely plausible and no subject was supplied, ask the user to choose by sender/subject/date, never by ID.
- This is required before answering questions about email body content.
- Prefer body_text for summaries and insights. body_html is sanitized and only present when Gmail returned HTML.

RETURNS receipt: { message }. The message includes subject, from, to, date, body_text, optional body_html, attachments metadata, id, and threadId.
- id and threadId are technical IDs — never read aloud or quote.
- attachments are metadata only; no attachment bytes are downloaded.
- If the read fails, say Gmail could not open the message instead of guessing from the snippet.`,
  isReadOnly: true,
  inputSchema: z.object({
    message_id: z.string().optional().describe('Internal Gmail message id returned by gmail.search_messages. Resolve internally; never ask the user for it.'),
    sender: z.string().optional().describe('Natural sender/display name or email from a prior result, such as "Pedro Sobral". Use for follow-ups when message_id is not available.'),
    subject: z.string().optional().describe('Natural email subject or visible subject fragment, such as "AULA 3 COMEÇOU". Use for follow-ups when message_id is not available.'),
    query: z.string().optional().describe('Gmail search expression to resolve the message before reading. Do not include relative dates unless the user explicitly asked for that date.'),
    hint: z.string().optional().describe('Quoted text, snippet, or visible list line from the conversation that helps resolve the email.'),
  }).refine(
    (args) => Boolean(args.message_id?.trim() || args.sender?.trim() || args.subject?.trim() || args.query?.trim() || args.hint?.trim()),
    'Provide message_id or a natural selector such as sender, subject, query, or hint.',
  ),
  call: async (args, context) => {
    const accountId = await getGoogleAccountId(context);
    if (!accountId) return { ok: false, error: 'No active Google account connected.' };
    try {
      let messageId = args.message_id?.trim();
      let resolvedFrom: { subject: string; from: string; date: string } | undefined;

      if (!messageId) {
        const query = buildGmailReadQuery(args);
        if (!query) return { ok: false, error: 'No email selected. Use the sender or subject from the previous email list.' };

        const candidates = await searchEmails(accountId, query, 10, context);
        const picked = pickGmailCandidate(candidates, args);
        if (!picked.selected) {
          if (picked.ambiguous.length > 1) {
            return {
              ok: false,
              error: 'Multiple emails match that description. Ask the user to choose by subject or date, not by ID.',
              receipt: { candidates: picked.ambiguous.map(({ subject, from, date }) => ({ subject, from, date })) },
            };
          }
          return { ok: false, error: 'I could not find that email from the sender or subject in the previous result. Ask the user for the sender, subject, or date in plain language.' };
        }

        messageId = picked.selected.id;
        resolvedFrom = {
          subject: picked.selected.subject,
          from: picked.selected.from,
          date: picked.selected.date,
        };
      }

      const message = await readEmailMessage(accountId, messageId, context);
      return {
        ok: true,
        data: { message },
        receipt: {
          message: {
            id: message.id,
            threadId: message.threadId,
            subject: message.subject,
            from: message.from,
            to: message.to,
            date: message.date,
            snippet: message.snippet,
            body_text_length: message.body_text?.length || 0,
            attachment_count: message.attachments?.length || 0,
          },
          resolved_from: resolvedFrom,
        },
      };
    } catch (e: any) {
      const googleMsg = e?.response?.data?.error?.message || e?.errors?.[0]?.message || e?.message;
      const errCode = e?.response?.data?.error?.code || e?.code;
      const status = e?.response?.data?.error?.status;
      let detailedError = errCode && googleMsg ? `Google API ${errCode}: ${googleMsg}` : (googleMsg || 'Failed to read Gmail message');
      if (errCode === 401 || errCode === 403 || status === 'PERMISSION_DENIED' || /scope|consent|authoriz/i.test(googleMsg || '')) {
        detailedError = `Gmail connection needs refresh. Ask the user to open Connectors and click Reconnect account.`;
      }
      console.error('[gmail.read_message] Google API error:', { errCode, status, googleMsg });
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
      const draft = await createDraft(accountId, args.to, args.subject, args.body, context);
      return { ok: true, receipt: { draft_id: draft.id, message_id: draft.messageId, status: 'draft_created' } };
    } catch (e: any) {
      const googleMsg = e?.response?.data?.error?.message || e?.errors?.[0]?.message || e?.message;
      const errCode = e?.response?.data?.error?.code || e?.code;
      const status = e?.response?.data?.error?.status;
      let detailedError = errCode && googleMsg ? `Google API ${errCode}: ${googleMsg}` : (googleMsg || 'Failed to create Gmail draft');
      if (errCode === 401 || errCode === 403 || status === 'PERMISSION_DENIED' || /scope|consent|authoriz/i.test(googleMsg || '')) {
        detailedError = `Gmail connection needs refresh. Ask the user to open Connectors and click Reconnect account.`;
      }
      console.error('[gmail.create_draft] Google API error:', { errCode, status, googleMsg });
      return { ok: false, error: detailedError };
    }
  },
});
