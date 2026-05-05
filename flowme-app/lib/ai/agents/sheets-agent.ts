import OpenAI from 'openai';
import { google } from 'googleapis';
import { getGoogleOAuthClient } from '@/lib/google/google-auth';

// ─────────────────────────────────────────────────────────────────────────────
// Sheets Agent — specialist sub-agent for reading and editing Google Sheets.
// Runs a 3-phase pipeline: READ (understand current state) → PLAN (decide
// operations) → EXECUTE (apply changes via Sheets API).
// ─────────────────────────────────────────────────────────────────────────────

const SHEETS_AGENT_SYSTEM = `You are the Sheets Agent — a specialist AI for reading and editing Google Sheets. You have deep knowledge of spreadsheet structure, formulas, data integrity, and UX best practices.

## Your personality
Precise, methodical, and cautious. You never guess. You always read the current state before writing. You explain what you're about to change before changing it.

## Technical knowledge

### Spreadsheet architecture
- Workbooks contain multiple sheets (tabs). Always confirm the correct sheet name before reading/writing.
- Ranges: A1 notation (Sheet1!A1:D10), named ranges, and row/column references.
- Data types: text, numbers, dates (stored as serial numbers), booleans, errors (#REF!, #VALUE!, etc.).
- Header rows: row 1 is almost always headers. Never overwrite them unless explicitly asked.
- Frozen rows/columns: respect freeze settings when appending data.

### Formula best practices
- Use relative refs (A1) for formulas that should copy across rows/columns.
- Use absolute refs ($A$1) for lookup tables, constants, and configuration cells.
- Prefer structured table references (Tables) over raw ranges when the sheet uses them.
- Common formulas you know deeply: VLOOKUP, INDEX/MATCH, SUMIF, COUNTIF, IFERROR, ARRAYFORMULA, QUERY, IMPORTRANGE.
- Never introduce circular references.
- Date formulas: DATE(), TODAY(), EDATE(), NETWORKDAYS(). Store dates as DATE values, not text strings.

### Data integrity rules
- Append rows at the end of existing data — never insert in the middle unless explicitly asked.
- When updating a cell, preserve the data type (don't turn a number into a string).
- Preserve formatting intent: if a column is currency, write numbers, not text.
- Never delete rows or columns without explicit confirmation.
- Before any PATCH/update, always READ the target range to confirm current values.

### Value input options
- RAW: sends the value as-is. Use for numbers, dates as ISO strings, booleans.
- USER_ENTERED: lets Sheets parse it like a user typed it. Use for formulas (=SUM(A1:A10)), or when the user wants Sheets to interpret the value.
- For formulas, always use USER_ENTERED.

### Range conventions
- A1:A — the entire column A (avoid on large sheets, use a bounded range instead).
- Sheet1!A2:D — from row 2 to end of data in columns A-D.
- To append: first find the last non-empty row, then write to last_row+1.

## Execution rules
1. READ first. Always fetch the target range before writing to understand current structure.
2. PLAN out loud. Before executing, state: what cells will change, what the new values will be, and why.
3. EXECUTE atomically. Batch writes where possible (one batchUpdate > many single updates).
4. CONFIRM. After writing, re-read the written range and verify it matches intent.
5. REPORT concisely. Tell the user what changed, not the raw API response.

## What you must never do
- Never overwrite the header row (row 1) unless explicitly asked.
- Never delete data without saying exactly which rows/columns will be removed.
- Never write formulas as plain text (they won't calculate — use USER_ENTERED).
- Never fabricate cell values. If you don't know what belongs in a cell, ask.
- Never assume the sheet structure. Read it first.`;

export interface SheetsAgentOptions {
  spreadsheetId: string;
  linkedAccountId: string;
  supabase: any;
  task: string;
  onProgress?: (event: { type: string; [key: string]: unknown }) => void;
}

export interface SheetsAgentResult {
  ok: boolean;
  summary: string;
  changes: Array<{ range: string; description: string }>;
  error?: string;
}

function failResult(error: string): SheetsAgentResult {
  return { ok: false, summary: '', changes: [], error };
}

function createOpenAIClient() {
  if (process.env.OPENAI_API_KEY) return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  if (process.env.GEMINI_API_KEY) return new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  });
  return null;
}

async function getAuthorizedSheetsClient(linkedAccountId: string, supabase: any) {
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
  return google.sheets({ version: 'v4', auth: oauth2 });
}

// Read sheet metadata: sheet names + first 3 rows of each sheet for context
async function readSheetContext(sheetsApi: any, spreadsheetId: string): Promise<string> {
  try {
    const meta = await sheetsApi.spreadsheets.get({ spreadsheetId, includeGridData: false });
    const sheetNames = (meta.data.sheets || []).map((s: any) => s.properties?.title).filter(Boolean);

    const previews: string[] = [];
    for (const name of sheetNames.slice(0, 5)) { // limit to 5 sheets
      try {
        const res = await sheetsApi.spreadsheets.values.get({
          spreadsheetId,
          range: `${name}!A1:Z5`,
        });
        const rows = res.data.values || [];
        const preview = rows.map((r: string[]) => r.join(' | ')).join('\n');
        previews.push(`Sheet: "${name}"\n${preview || '(empty)'}`);
      } catch { previews.push(`Sheet: "${name}" (could not read)`); }
    }

    return [
      `Spreadsheet title: ${meta.data.properties?.title || 'Untitled'}`,
      `Sheets: ${sheetNames.join(', ')}`,
      '',
      ...previews,
    ].join('\n');
  } catch (e: any) {
    return `Could not read spreadsheet metadata: ${e?.message}`;
  }
}

// The Sheets Agent operates by giving the LLM the current sheet context and
// asking it to produce a list of Sheets API operations as structured JSON.
// We then execute those operations via the real Sheets API.
export async function runSheetsAgent(options: SheetsAgentOptions): Promise<SheetsAgentResult> {
  const { spreadsheetId, linkedAccountId, supabase, task, onProgress } = options;

  const emit = (type: string, data: Record<string, unknown>) => {
    try { onProgress?.({ type, ...data }); } catch {}
  };

  const sheetsApi = await getAuthorizedSheetsClient(linkedAccountId, supabase);
  if (!sheetsApi) return failResult('Could not authenticate with Google Sheets.');

  const llm = createOpenAIClient();
  if (!llm) return failResult('No LLM provider available.');

  const model = process.env.OPENAI_API_KEY ? 'gpt-4o' : 'gemini-2.5-pro';

  // ── Phase 1: READ ──────────────────────────────────────────────────────────
  emit('tool_call_start', { tool: 'sheets_agent.read', call_id: 'sheets-read', args: { spreadsheetId } });
  const sheetContext = await readSheetContext(sheetsApi, spreadsheetId);
  emit('tool_call_end', { tool: 'sheets_agent.read', call_id: 'sheets-read', ok: true, receipt: { summary: 'Sheet structure read' } });

  // ── Phase 2: PLAN + EXECUTE via structured LLM call ───────────────────────
  emit('tool_call_start', { tool: 'sheets_agent.plan', call_id: 'sheets-plan', args: { task } });

  const planPrompt = `
CURRENT SPREADSHEET STATE:
${sheetContext}

USER REQUEST:
${task}

Based on the spreadsheet state above, produce a JSON response with this exact shape:
{
  "plan": "2-3 sentence explanation of what you will do and why",
  "operations": [
    {
      "type": "values_update",
      "range": "Sheet1!A2:B2",
      "values": [["value1", "value2"]],
      "valueInputOption": "USER_ENTERED"
    }
  ],
  "summary": "One sentence of what changed, for the user"
}

Operation types:
- "values_update": update cell values. Include range (A1 notation), values (2D array), valueInputOption ("RAW" or "USER_ENTERED").
- "values_append": append rows. Include range (the table range to append to), values, valueInputOption.
- "values_clear": clear a range. Include range only.

Rules:
- Only include operations. No commentary outside the JSON.
- Never modify row 1 (headers) unless the user explicitly asked to rename a column.
- Prefer USER_ENTERED for anything that might be a formula or date string.
- If the task cannot be done safely (ambiguous target, risk of data loss), set operations to [] and explain in plan.
`.trim();

  let planText = '';
  try {
    const response = await llm.chat.completions.create({
      model,
      temperature: 0.1,
      messages: [
        { role: 'system', content: SHEETS_AGENT_SYSTEM },
        { role: 'user', content: planPrompt },
      ],
      response_format: { type: 'json_object' },
    });
    planText = response.choices[0]?.message?.content?.trim() || '{}';
  } catch (e: any) {
    return failResult(`LLM planning failed: ${e?.message}`);
  }

  let parsed: { plan?: string; operations?: any[]; summary?: string };
  try {
    parsed = JSON.parse(planText);
  } catch {
    return failResult('Agent returned invalid plan JSON.');
  }

  emit('tool_call_end', {
    tool: 'sheets_agent.plan', call_id: 'sheets-plan', ok: true,
    receipt: { plan: parsed.plan, operation_count: (parsed.operations || []).length },
  });

  const operations = parsed.operations || [];
  if (operations.length === 0) {
    return { ok: true, summary: parsed.plan || 'No changes needed.', changes: [] };
  }

  // ── Phase 3: EXECUTE ───────────────────────────────────────────────────────
  emit('tool_call_start', { tool: 'sheets_agent.execute', call_id: 'sheets-exec', args: { operation_count: operations.length } });

  const changes: Array<{ range: string; description: string }> = [];

  for (const op of operations) {
    try {
      if (op.type === 'values_update') {
        await sheetsApi.spreadsheets.values.update({
          spreadsheetId,
          range: op.range,
          valueInputOption: op.valueInputOption || 'USER_ENTERED',
          requestBody: { values: op.values },
        });
        changes.push({ range: op.range, description: `Updated ${op.range}` });
      } else if (op.type === 'values_append') {
        await sheetsApi.spreadsheets.values.append({
          spreadsheetId,
          range: op.range,
          valueInputOption: op.valueInputOption || 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: op.values },
        });
        changes.push({ range: op.range, description: `Appended rows to ${op.range}` });
      } else if (op.type === 'values_clear') {
        await sheetsApi.spreadsheets.values.clear({
          spreadsheetId,
          range: op.range,
          requestBody: {},
        });
        changes.push({ range: op.range, description: `Cleared ${op.range}` });
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || 'Unknown error';
      emit('tool_call_end', { tool: 'sheets_agent.execute', call_id: 'sheets-exec', ok: false, error: msg });
      return { ok: false, summary: '', changes, error: `Sheets API error on ${op.range}: ${msg}` };
    }
  }

  emit('tool_call_end', {
    tool: 'sheets_agent.execute', call_id: 'sheets-exec', ok: true,
    receipt: { changes_applied: changes.length, summary: parsed.summary },
  });

  return { ok: true, summary: parsed.summary || `Applied ${changes.length} change(s).`, changes };
}
