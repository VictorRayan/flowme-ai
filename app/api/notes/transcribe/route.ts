import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';
import OpenAI from 'openai';

const PRETTIFY_SYSTEM_PROMPT = `You are a note-taking assistant. Your job is to transcribe a new voice recording and append it to an existing note as structured HTML.

Rules:
- Use ONLY these tags: <h1>, <h2>, <h3>, <p>, <strong>, <em>, <ul>, <li>, <ol>, <code>, <pre><code>, <blockquote>, <hr>
- Do NOT include <html>, <head>, <body>, <div>, or any wrapper tags
- Output only the inner HTML fragment for the NEW content to append — nothing else, no markdown fences
- DO NOT repeat or rewrite the existing note content — only output the new section
- Preserve ALL information from the new transcript — do not summarize or omit anything
- Use the existing note content as context to maintain consistent terminology, topics, and tone
- If the new recording continues or expands a topic already in the note, structure it accordingly (e.g. add to the same section theme, reference earlier points)
- Add structure where it makes content clearer:
  - Use headings for distinct topics
  - Use bullet lists for enumerations or items mentioned
  - Use numbered lists for steps or sequences
  - Use <strong> for emphasis or key terms the speaker stressed
  - Use <em> for asides or softer emphasis
  - Use <code> for anything that sounds like code, commands, or technical terms
  - Use <blockquote> for quotes or something the speaker is citing
- If the speaker mentions a time or date (e.g. "at 3pm", "tomorrow"), wrap it in <strong>
- Start the new section with an <hr> separator, then a short <h2> summarizing the new recording's main theme`;

// POST /api/notes/transcribe
// Body: multipart/form-data — fields: audio (File), provider ('openai'|'gemini'), model (string), existingContent (string, optional)
// Returns: { html, rawTranscription }
export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);

    const formData = await request.formData();
    const audioFile       = formData.get('audio') as File | null;
    const provider        = (formData.get('provider')        as string) || 'openai';
    const model           = (formData.get('model')           as string) || '';
    const existingContent = (formData.get('existingContent') as string) || '';

    if (!audioFile) return apiError(ErrorCode.VALIDATION_ERROR, 'audio field is required');

    if (provider === 'gemini') {
      return await handleGemini(audioFile, model, existingContent);
    }
    return await handleOpenAI(audioFile, model, existingContent);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[notes/transcribe] error:', msg);
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── OpenAI: Whisper → GPT-4o ────────────────────────────────────────────────

async function handleOpenAI(audioFile: File, modelOverride: string, existingContent: string) {
  if (!process.env.OPENAI_API_KEY) {
    return apiError(ErrorCode.INTERNAL_ERROR, 'OpenAI API key not configured');
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Phase 1 — Whisper transcription
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    response_format: 'text',
  });
  const rawText = typeof transcription === 'string'
    ? transcription
    : (transcription as { text: string }).text;

  if (!rawText?.trim()) return NextResponse.json({ html: '<p></p>', rawTranscription: '' });

  // Phase 2 — GPT-4o prettification
  const prettifyModel = modelOverride || 'gpt-4o';
  const userContent = existingContent?.trim()
    ? `Existing note content (for context only — do NOT repeat it):\n${existingContent}\n\n---\n\nNew transcription to append:\n${rawText}`
    : `Transcription:\n${rawText}`;
  const completion = await openai.chat.completions.create({
    model: prettifyModel,
    messages: [
      { role: 'system', content: PRETTIFY_SYSTEM_PROMPT },
      { role: 'user',   content: userContent },
    ],
    temperature: 0.3,
  });

  const html = completion.choices[0]?.message?.content?.trim() || `<p>${rawText}</p>`;
  return NextResponse.json({ html, rawTranscription: rawText });
}

// ─── Gemini: audio → transcription + prettification in one call ───────────────
// Gemini 2.0 Flash natively understands audio — no separate transcription step needed.

async function handleGemini(audioFile: File, modelOverride: string, existingContent: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return apiError(ErrorCode.INTERNAL_ERROR, 'Gemini API key not configured');

  const modelId = modelOverride || 'gemini-2.0-flash';

  // Convert audio file to base64
  const arrayBuffer = await audioFile.arrayBuffer();
  const base64Audio = Buffer.from(arrayBuffer).toString('base64');
  const mimeType = audioFile.type || 'audio/webm';

  const contextBlock = existingContent?.trim()
    ? `\n\nExisting note content (for context only — do NOT repeat it):\n${existingContent}\n\n---\n\n`
    : '\n\n';
  const prompt = `${PRETTIFY_SYSTEM_PROMPT}${contextBlock}Listen to this audio recording and transcribe it, then immediately format the transcription as structured HTML to append to the note. Do not describe the audio — just transcribe what is said and format it as a new section.`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { inline_data: { mime_type: mimeType, data: base64Audio } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    let msg = 'Gemini API error';
    try {
      const errJson = JSON.parse(errText);
      const code = errJson?.error?.code;
      const status = errJson?.error?.status;
      if (code === 429 || status === 'RESOURCE_EXHAUSTED') {
        msg = `Quota exceeded for "${modelId}". Try again in a moment or switch to a different model.`;
      } else if (code === 404) {
        msg = `Model "${modelId}" is not available with your API key.`;
      } else {
        msg = errJson?.error?.message || errText;
      }
    } catch { msg = errText; }
    return NextResponse.json({ error: msg }, { status: res.status });
  }

  const data = await res.json();
  const html = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '<p></p>';

  return NextResponse.json({ html, rawTranscription: null });
}
