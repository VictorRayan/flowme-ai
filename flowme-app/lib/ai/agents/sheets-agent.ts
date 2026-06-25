import OpenAI from 'openai';
import { google } from 'googleapis';
import { getGoogleOAuthClient } from '@/lib/google/google-auth';

// ─────────────────────────────────────────────────────────────────────────────
// Google Sheets Financial Economist Agent: specialist sub-agent for insights and precise sheet edits.
// Runs a 3-phase pipeline: READ (understand current state) → PLAN (decide
// operations) → EXECUTE (apply changes via Sheets API).
// ─────────────────────────────────────────────────────────────────────────────

export const SHEETS_ECONOMIST_AGENT_SYSTEM = `You are the Google Sheets Financial Economist Agent: a financial markets economist, spreadsheet modeler, and Google Sheets API specialist.

You can inspect spreadsheet context, understand layout and formatting intent, generate financial insights, improve models, write formulas, and edit sheets with precision. You work in English internally for reliability, but user-facing summaries must follow the user's language.

## Your personality
Precise, methodical, financially literate, and cautious. You never guess. You always read the current state before writing. You distinguish observation from recommendation and preserve the user's spreadsheet structure.

## Financial knowledge

- Personal finance: budgets, cash flow, fixed vs variable expenses, debt, savings rate, runway, category concentration, recurring costs, and anomalies.
- Business finance: revenue, COGS, gross margin, EBITDA, cash conversion, working capital, unit economics, cohorts, forecasts, and scenario planning.
- Market finance: interest rates, inflation, FX, risk premium, volatility, diversification, liquidity, duration, drawdown, and sensitivity analysis.
- Analysis patterns: trend, variance, month-over-month change, budget-vs-actual, Pareto categories, outliers, seasonality, and concentration risk.
- Insight discipline: every insight must cite evidence from the sheet context, then provide a practical recommendation.
- Multilingual output: reason in English, answer in the user's language.

## Technical knowledge

### Spreadsheet architecture
- Workbooks contain multiple sheets (tabs). Always confirm the correct sheet name before reading/writing.
- Ranges: A1 notation (Sheet1!A1:D10), named ranges, and row/column references.
- Data types: text, numbers, dates (stored as serial numbers), booleans, errors (#REF!, #VALUE!, etc.).
- Header rows: row 1 is almost always headers. Never overwrite them unless explicitly asked.
- Frozen rows/columns: respect freeze settings when appending data.
- Layout intelligence: infer tables, sections, totals, notes, merged visual blocks, blank separators, and dashboard areas before writing.
- Formatting intelligence: preserve currency, percentage, date, decimal precision, bold headers, background colors, alignment, frozen rows, and totals formatting.
- When adding rows, formulas, or insights, place them where they fit the existing information architecture instead of dumping data into the first empty cell.
- Orientation intelligence: a table can be vertical (headers across columns), horizontal (headers down rows), diagonal or matrix-like, calendar-like, dashboard-like, or split into several blocks on one sheet. Identify orientation before planning writes.
- Multi-tab intelligence: infer whether the request belongs to a monthly tab, category tab, raw-data tab, dashboard tab, or summary tab. Prefer raw transaction/input tabs for new rows and summary/dashboard tabs for formulas and insights.
- Expense entry intelligence: for requests like "add Uber 32 reais yesterday", identify description, amount, date, category, account/payment method, currency, recurrence, notes, and status from the request and sheet headers. If one required field is missing and cannot be safely inferred, ask one concise question instead of writing partial data.
- Category inference: infer common personal-finance categories such as Alimentacao/Food, Transporte/Transport, Moradia/Housing, Saude/Health, Educacao/Education, Lazer/Leisure, Assinaturas/Subscriptions, Receita/Income, Investimentos/Investments, Impostos/Taxes, and Outros/Other, but preserve the sheet's existing category vocabulary when visible.
- Formula and total safety: identify total rows, subtotal rows, dashboard formulas, protected-looking ranges, and formula columns. Never append inside a totals section and never overwrite a formula unless the user explicitly asks to fix that formula.

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
2. PLAN precisely. Before executing, state: what cells will change, what the new values will be, and why.
3. EXECUTE atomically. Batch writes where possible (one batchUpdate > many single updates).
4. CONFIRM. After writing, re-read the written range and verify it matches intent.
5. INSIGHT mode. If the user asks for analysis, diagnosis, trends, spending insights, or recommendations, do not modify the sheet; return evidence-backed insights.
6. REPORT concisely. Tell the user what changed or what the financial insight is, not the raw API response.

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
  mode?: 'auto' | 'analyze' | 'edit';
  onProgress?: (event: { type: string; [key: string]: unknown }) => void;
}

export interface SheetsAgentResult {
  ok: boolean;
  summary: string;
  changes: Array<{ range: string; description: string }>;
  insights?: Array<{ title: string; evidence: string; recommendation?: string }>;
  error?: string;
}

function failResult(error: string): SheetsAgentResult {
  return { ok: false, summary: '', changes: [], error };
}

function quoteSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

function createLlmPlanTargets() {
  const targets: Array<{ provider: 'gemini' | 'openai'; model: string; client: OpenAI }> = [];
  if (process.env.GEMINI_API_KEY) {
    targets.push({
      provider: 'gemini',
      model: 'gemini-2.5-pro',
      client: new OpenAI({
        apiKey: process.env.GEMINI_API_KEY,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      }),
    });
  }
  if (process.env.OPENAI_API_KEY) {
    targets.push({
      provider: 'openai',
      model: 'gpt-4o',
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    });
  }
  return targets;
}

async function createJsonPlanCompletion(
  targets: ReturnType<typeof createLlmPlanTargets>,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
): Promise<string> {
  let lastError: unknown = null;
  for (const target of targets) {
    try {
      const response = await target.client.chat.completions.create({
        model: target.model,
        temperature: 0.1,
        messages,
        response_format: { type: 'json_object' },
      });
      return response.choices[0]?.message?.content?.trim() || '{}';
    } catch (error) {
      lastError = error;
      console.warn(`[sheets-agent] ${target.provider}:${target.model} planning failed, trying fallback if available:`, error);
    }
  }
  throw lastError || new Error('No LLM provider available.');
}

function buildDeterministicSheetResult(sheetContext: string): SheetsAgentResult {
  const lines = sheetContext.split('\n').map((line) => line.trim()).filter(Boolean);
  const title = lines.find((line) => line.startsWith('Spreadsheet title:'))?.replace('Spreadsheet title:', '').trim() || 'spreadsheet';
  const sheets = lines.find((line) => line.startsWith('Sheets:'))?.replace('Sheets:', '').trim();
  const evidence = lines.slice(0, 24).join('\n').slice(0, 4000);
  return {
    ok: true,
    summary: `I read "${title}" and found ${sheets ? `these tabs: ${sheets}` : 'spreadsheet data'}.`,
    changes: [],
    insights: [{
      title: 'Spreadsheet content',
      evidence,
      recommendation: 'Ask for a specific analysis if you want trends, totals, anomalies, or recommendations.',
    }],
  };
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

// Read sheet metadata, layout, and enough rows for analysis/editing context.
async function readSheetContext(sheetsApi: any, spreadsheetId: string): Promise<string> {
  try {
    const meta = await sheetsApi.spreadsheets.get({ spreadsheetId, includeGridData: false });
    const sheets = meta.data.sheets || [];
    const sheetNames = sheets.map((s: any) => s.properties?.title).filter(Boolean);

    const previews: string[] = [];
    for (const sheet of sheets.slice(0, 5)) {
      const name = sheet.properties?.title;
      if (!name) continue;
      const grid = sheet.properties?.gridProperties || {};
      try {
        const res = await sheetsApi.spreadsheets.values.get({
          spreadsheetId,
          range: `${quoteSheetName(name)}!A1:Z100`,
        });
        const rows = res.data.values || [];
        const preview = rows.map((r: string[]) => r.join(' | ')).join('\n');
        previews.push([
          `Sheet: "${name}"`,
          `Grid: ${grid.rowCount || 'unknown'} rows x ${grid.columnCount || 'unknown'} columns; frozen rows: ${grid.frozenRowCount || 0}; frozen columns: ${grid.frozenColumnCount || 0}`,
          preview || '(empty)',
        ].join('\n'));
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

// The Financial Economist Agent operates by giving the LLM the current sheet context and
// asking it to produce a list of Sheets API operations as structured JSON.
// We then execute those operations via the real Sheets API.
export async function runSheetsAgent(options: SheetsAgentOptions): Promise<SheetsAgentResult> {
  const { spreadsheetId, linkedAccountId, supabase, task, mode = 'auto', onProgress } = options;

  const emit = (type: string, data: Record<string, unknown>) => {
    try { onProgress?.({ type, ...data }); } catch {}
  };

  const sheetsApi = await getAuthorizedSheetsClient(linkedAccountId, supabase);
  if (!sheetsApi) return failResult('Could not authenticate with Google Sheets.');

  const llmTargets = createLlmPlanTargets();

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

MODE:
${mode}

Based on the spreadsheet state above, produce a JSON response with this exact shape:
{
  "plan": "2-3 sentence explanation of what you will do and why",
  "insights": [
    {
      "title": "Short insight title",
      "evidence": "Specific evidence from the sheet context",
      "recommendation": "Practical recommendation when useful"
    }
  ],
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
- For financial insight, expense analysis, diagnosis, trend analysis, or explanation requests, set operations to [] and fill insights with evidence-backed observations.
- If mode is "analyze", do not create write operations.
- If mode is "edit", only include write operations that are clear and safe from the user's request.
- If the task cannot be done safely (ambiguous target, risk of data loss), set operations to [] and explain in plan.
- For expense/income additions, map the user's natural language to the sheet's existing headers. Use existing category vocabulary when present. If amount, date, target sheet/tab, or required account/payment method is missing and cannot be inferred from context, set operations to [] and ask for that missing field in the summary.
- For horizontal, matrix, or dashboard layouts, do not force row append. Explain the required clarification or choose the correct cell/range only when the structure is clear from the sheet context.
`.trim();

  let planText = '';
  try {
    planText = await createJsonPlanCompletion(llmTargets, [
      { role: 'system', content: SHEETS_ECONOMIST_AGENT_SYSTEM },
      { role: 'user', content: planPrompt },
    ]);
  } catch (e: any) {
    emit('tool_call_end', {
      tool: 'sheets_agent.plan',
      call_id: 'sheets-plan',
      ok: true,
      receipt: { plan: 'LLM planning unavailable; returning deterministic sheet summary.', fallback: true },
    });
    return buildDeterministicSheetResult(sheetContext);
  }

  let parsed: { plan?: string; operations?: any[]; insights?: Array<{ title?: string; evidence?: string; recommendation?: string }>; summary?: string };
  try {
    parsed = JSON.parse(planText);
  } catch {
    return failResult('Agent returned invalid plan JSON.');
  }

  emit('tool_call_end', {
    tool: 'sheets_agent.plan', call_id: 'sheets-plan', ok: true,
    receipt: { plan: parsed.plan, insight_count: (parsed.insights || []).length, operation_count: (parsed.operations || []).length },
  });

  const operations = parsed.operations || [];
  if (operations.length === 0) {
    return {
      ok: true,
      summary: parsed.summary || parsed.plan || 'No changes needed.',
      changes: [],
      insights: (parsed.insights || []).map((insight) => ({
        title: insight.title || 'Insight',
        evidence: insight.evidence || '',
        recommendation: insight.recommendation,
      })),
    };
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

  return {
    ok: true,
    summary: parsed.summary || `Applied ${changes.length} change(s).`,
    changes,
    insights: (parsed.insights || []).map((insight) => ({
      title: insight.title || 'Insight',
      evidence: insight.evidence || '',
      recommendation: insight.recommendation,
    })),
  };
}
