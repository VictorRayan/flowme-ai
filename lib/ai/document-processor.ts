import { GoogleGenAI } from '@google/genai';

/**
 * AI Document Processor.
 *
 * Extracts text from documents and generates:
 * - One-line summary
 * - Structured key points in markdown
 * - Suggested tags
 *
 * Uses Gemini Flash for fast, cost-efficient processing.
 */

const PROCESSABLE_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'application/json',
  'application/xml',
  'text/xml',
  'application/javascript',
  'text/javascript',
  'text/typescript',
  'text/x-python',
  'text/x-java-source',
  'text/x-c',
  'text/x-cpp',
  'text/yaml',
  'text/x-yaml',
];

export function isTextProcessable(mimeType: string): boolean {
  return PROCESSABLE_MIME_TYPES.some(t => mimeType.startsWith(t)) ||
    mimeType.startsWith('text/');
}

export function extractTextFromBuffer(buffer: Buffer, mimeType: string): string | null {
  if (isTextProcessable(mimeType)) {
    return buffer.toString('utf-8');
  }
  // For binary formats (PDF, DOCX, etc.) — would need specialized parsers
  // TODO: Add pdf-parse, mammoth, etc. for binary document extraction
  return null;
}

export interface DocumentAnalysis {
  summary: string;        // One-line summary
  key_points: string;     // Markdown formatted key points
  tags: string[];          // Suggested tags
  content_text: string;    // Clean extracted text (truncated for DB)
}

export async function analyzeDocument(opts: {
  filename: string;
  content: string;
  mimeType: string;
}): Promise<DocumentAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const ai = new GoogleGenAI({ apiKey });

  // Truncate content for the prompt (keep under token limits)
  const maxChars = 100_000;
  const truncatedContent = opts.content.length > maxChars
    ? opts.content.slice(0, maxChars) + '\n\n[... truncated ...]'
    : opts.content;

  const prompt = `You are a knowledge base librarian. Analyze this document and produce structured knowledge.

**File:** ${opts.filename}
**Type:** ${opts.mimeType}

**Document Content:**
\`\`\`
${truncatedContent}
\`\`\`

Respond with EXACTLY this JSON format (no markdown code fences, just raw JSON):
{
  "summary": "One concise sentence that captures what this document is about",
  "key_points": "## Key Points\\n\\n- Point 1\\n- Point 2\\n- Point 3\\n\\n## Details\\n\\nAdditional structured notes in markdown",
  "tags": ["tag1", "tag2", "tag3"]
}

Rules:
- Summary must be a single sentence, max 150 characters
- Key points should be in clean markdown with headers and bullets
- Tags should be 3-7 lowercase single-word or hyphenated labels
- Focus on facts, data, decisions, and actionable information
- If the document references people, projects, or dates — capture them in key points`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  });

  const text = response.text || '';

  try {
    // Try to parse JSON from the response (handle potential markdown fencing)
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    return {
      summary: parsed.summary || 'No summary generated',
      key_points: parsed.key_points || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      content_text: opts.content.slice(0, 50_000), // Store up to 50k chars for search
    };
  } catch {
    // Fallback if JSON parsing fails
    return {
      summary: text.slice(0, 150),
      key_points: text,
      tags: [],
      content_text: opts.content.slice(0, 50_000),
    };
  }
}
