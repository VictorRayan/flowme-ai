import OpenAI from 'openai';
import { google } from 'googleapis';
import { getGoogleOAuthClient } from '@/lib/google/google-auth';

// ─────────────────────────────────────────────────────────────────────────────
// Docs Agent — specialist sub-agent for reading and editing Google Docs.
// Runs a 3-phase pipeline: READ (understand document structure) → PLAN (decide
// what to insert/replace/delete) → EXECUTE (apply via Docs batchUpdate API).
// ─────────────────────────────────────────────────────────────────────────────

const DOCS_AGENT_SYSTEM = `You are the Docs Agent — a specialist AI for reading and editing Google Docs. You have deep knowledge of document structure, the Google Docs API, writing quality, and document best practices.

## Your personality
Careful, precise, and style-conscious. You preserve the author's voice and formatting intent. You never rewrite sections the user didn't ask to change. You explain edits before making them.

## Technical knowledge

### Document structure (Google Docs API)
A Google Doc is a tree of structural elements:
- Paragraph: the basic block. Contains text runs, each with optional text style (bold, italic, fontSize, etc.).
- Table: rows and cells, each containing paragraphs.
- SectionBreak: separates sections with different page layout.
- TableOfContents: auto-generated from heading paragraphs.

### Paragraph styles
- NORMAL_TEXT: body text
- HEADING_1 through HEADING_6: section headings
- TITLE: document title paragraph
- SUBTITLE: document subtitle
Preserve existing heading hierarchy. If the doc uses H2 for section titles, new sections should also use H2.

### Text styles (inline)
- bold, italic, underline, strikethrough
- fontSize (in pt), foregroundColor (RGB)
- link: { url } for hyperlinks
- baselineOffset: SUPERSCRIPT or SUBSCRIPT

### Index-based editing (critical)
The Docs API uses character indices (startIndex, endIndex) for all edits.
- Index 0 is the start of the document body.
- Every character including newlines counts.
- Indices must be computed from the document's current content — you cannot guess them.
- Operations in a batchUpdate are applied in order. If you insert text, all subsequent indices shift.
- Solution: sort operations from end to start (highest index first) so earlier inserts don't shift later indices.

### Operation types you use
- insertText: { location: { index }, text } — insert text at a position
- deleteContentRange: { range: { startIndex, endIndex } } — delete a range
- replaceAllText: { containsText: { text, matchCase }, replaceText } — find-and-replace across entire document (safest for targeted word/phrase edits)
- insertPageBreak: { location: { index } } — add a page break
- createNamedRange / deleteNamedRange: for marking sections
- updateParagraphStyle: { range, paragraphStyle, fields } — change heading level, alignment, spacing
- updateTextStyle: { range, textStyle, fields } — bold, italic, font size, color

### Best practices

#### Prefer replaceAllText for targeted edits
If the user wants to change a specific word, phrase, or value that appears in the doc, use replaceAllText — it's index-free and safe.

#### Read indices from the document JSON
Never guess indices. Read the full document structure, extract the element indices from the JSON, then compute exactly where to insert or delete.

#### Preserve whitespace and formatting
When inserting a new paragraph at the end of a section, append \\n first to ensure a new paragraph is created. Match surrounding text style.

#### Tables
To add a row, use insertTableRow. To modify cell content, use insertText/deleteContentRange within the cell's paragraph.

#### Named ranges
Use named ranges to mark positions you'll edit repeatedly. Safer than hardcoded indices for recurring edits.

#### Writing quality
When generating new content (not just structural edits):
- Match the document's existing tone (formal/informal, first/third person).
- Use active voice, short sentences, concrete language.
- Add transitions when inserting between existing sections.
- Avoid filler phrases ("It is important to note that…").
- Use consistent terminology — if the doc says "client", don't switch to "customer".

## Execution rules
1. READ first. Always fetch the full document JSON to understand structure and get accurate indices.
2. PLAN out loud. State which sections will change and why before executing.
3. Prefer replaceAllText for targeted word/phrase edits — index-free and atomic.
4. Sort index-based operations from highest to lowest index to avoid shifting errors.
5. CONFIRM after executing: re-read the affected section and verify it looks correct.
6. REPORT what changed in plain language. No raw API output.

## What you must never do
- Never delete a section without explicit confirmation from the user.
- Never rewrite content the user didn't ask to change.
- Never use hardcoded guessed indices — always derive them from the document JSON.
- Never change the document title unless explicitly asked.
- Never fabricate content. If you need information to fill in a section, ask for it.`;

export interface DocsAgentOptions {
  documentId: string;
  linkedAccountId: string;
  supabase: any;
  task: string;
  onProgress?: (event: { type: string; [key: string]: unknown }) => void;
}

export interface DocsAgentResult {
  ok: boolean;
  summary: string;
  changes: Array<{ description: string }>;
  error?: string;
}

function failResult(error: string): DocsAgentResult {
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

async function getAuthorizedDocsClient(linkedAccountId: string, supabase: any) {
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
  return google.docs({ version: 'v1', auth: oauth2 });
}

// Extract a compact representation of the document for the LLM to work from
function extractDocSummary(doc: any): string {
  const title = doc.title || 'Untitled';
  const elements = doc.body?.content || [];

  const lines: string[] = [`Title: ${title}`, ''];
  let charIndex = 0;

  for (const el of elements) {
    if (el.paragraph) {
      const style = el.paragraph.paragraphStyle?.namedStyleType || 'NORMAL_TEXT';
      const text = (el.paragraph.elements || [])
        .map((e: any) => e.textRun?.content || '')
        .join('');
      const startIdx = el.startIndex ?? charIndex;
      const endIdx = el.endIndex ?? charIndex + text.length;
      if (text.trim()) {
        lines.push(`[${startIdx}-${endIdx}] ${style}: ${text.replace(/\n/g, '↵').slice(0, 200)}`);
      }
      charIndex = endIdx;
    } else if (el.table) {
      lines.push(`[${el.startIndex ?? charIndex}] TABLE (${el.table.rows} rows × ${el.table.columns} cols)`);
      charIndex = el.endIndex ?? charIndex;
    }
  }

  return lines.join('\n');
}

export async function runDocsAgent(options: DocsAgentOptions): Promise<DocsAgentResult> {
  const { documentId, linkedAccountId, supabase, task, onProgress } = options;

  const emit = (type: string, data: Record<string, unknown>) => {
    try { onProgress?.({ type, ...data }); } catch {}
  };

  const docsApi = await getAuthorizedDocsClient(linkedAccountId, supabase);
  if (!docsApi) return failResult('Could not authenticate with Google Docs.');

  const llm = createOpenAIClient();
  if (!llm) return failResult('No LLM provider available.');

  const model = process.env.OPENAI_API_KEY ? 'gpt-4o' : 'gemini-2.5-pro';

  // ── Phase 1: READ ──────────────────────────────────────────────────────────
  emit('tool_call_start', { tool: 'docs_agent.read', call_id: 'docs-read', args: { documentId } });

  let doc: any;
  try {
    const res = await docsApi.documents.get({ documentId });
    doc = res.data;
  } catch (e: any) {
    return failResult(`Could not read document: ${e?.message}`);
  }

  const docSummary = extractDocSummary(doc);
  emit('tool_call_end', {
    tool: 'docs_agent.read', call_id: 'docs-read', ok: true,
    receipt: { title: doc.title, paragraph_count: (doc.body?.content || []).length },
  });

  // ── Phase 2: PLAN + EXECUTE ────────────────────────────────────────────────
  emit('tool_call_start', { tool: 'docs_agent.plan', call_id: 'docs-plan', args: { task } });

  const planPrompt = `
CURRENT DOCUMENT STRUCTURE (indices are character positions):
${docSummary}

USER REQUEST:
${task}

Produce a JSON response with this exact shape:
{
  "plan": "2-3 sentence explanation of what you will do and why",
  "requests": [
    {
      "replaceAllText": {
        "containsText": { "text": "old phrase", "matchCase": true },
        "replaceText": "new phrase"
      }
    }
  ],
  "summary": "One sentence of what changed, for the user"
}

The "requests" array maps directly to Google Docs API batchUpdate requests.
Supported request types:
1. replaceAllText — PREFERRED for targeted word/phrase changes. Index-free.
2. insertText — { "location": { "index": N }, "text": "..." }
3. deleteContentRange — { "range": { "startIndex": N, "endIndex": M } }
4. updateParagraphStyle — { "range": {"startIndex":N,"endIndex":M}, "paragraphStyle": {"namedStyleType":"HEADING_2"}, "fields":"namedStyleType" }
5. updateTextStyle — { "range": {"startIndex":N,"endIndex":M}, "textStyle": {"bold":true}, "fields":"bold" }

CRITICAL rules:
- Sort index-based requests from HIGHEST startIndex to LOWEST (so earlier inserts don't shift later indices).
- Use replaceAllText whenever possible — it's the safest operation.
- If the task cannot be executed safely without more information, set requests to [] and explain in plan.
- Never guess indices — use the indices shown in the document structure above.
- Output ONLY valid JSON. No commentary outside the JSON.
`.trim();

  let planText = '';
  try {
    const response = await llm.chat.completions.create({
      model,
      temperature: 0.1,
      messages: [
        { role: 'system', content: DOCS_AGENT_SYSTEM },
        { role: 'user', content: planPrompt },
      ],
      response_format: { type: 'json_object' },
    });
    planText = response.choices[0]?.message?.content?.trim() || '{}';
  } catch (e: any) {
    return failResult(`LLM planning failed: ${e?.message}`);
  }

  let parsed: { plan?: string; requests?: any[]; summary?: string };
  try {
    parsed = JSON.parse(planText);
  } catch {
    return failResult('Agent returned invalid plan JSON.');
  }

  emit('tool_call_end', {
    tool: 'docs_agent.plan', call_id: 'docs-plan', ok: true,
    receipt: { plan: parsed.plan, request_count: (parsed.requests || []).length },
  });

  const requests = parsed.requests || [];
  if (requests.length === 0) {
    return { ok: true, summary: parsed.plan || 'No changes needed.', changes: [] };
  }

  // ── Phase 3: EXECUTE ───────────────────────────────────────────────────────
  emit('tool_call_start', {
    tool: 'docs_agent.execute', call_id: 'docs-exec',
    args: { request_count: requests.length },
  });

  try {
    await docsApi.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });
  } catch (e: any) {
    const msg = e?.response?.data?.error?.message || e?.message || 'Unknown error';
    emit('tool_call_end', { tool: 'docs_agent.execute', call_id: 'docs-exec', ok: false, error: msg });
    return { ok: false, summary: '', changes: [], error: `Docs API error: ${msg}` };
  }

  const changes = requests.map((r: any) => {
    if (r.replaceAllText) return { description: `Replaced "${r.replaceAllText.containsText?.text}" → "${r.replaceAllText.replaceText}"` };
    if (r.insertText) return { description: `Inserted text at index ${r.insertText.location?.index}` };
    if (r.deleteContentRange) return { description: `Deleted content [${r.deleteContentRange.range?.startIndex}–${r.deleteContentRange.range?.endIndex}]` };
    if (r.updateParagraphStyle) return { description: `Updated paragraph style` };
    if (r.updateTextStyle) return { description: `Updated text style` };
    return { description: 'Applied change' };
  });

  emit('tool_call_end', {
    tool: 'docs_agent.execute', call_id: 'docs-exec', ok: true,
    receipt: { changes_applied: changes.length, summary: parsed.summary },
  });

  return { ok: true, summary: parsed.summary || `Applied ${changes.length} change(s).`, changes };
}
