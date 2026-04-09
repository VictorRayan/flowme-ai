import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';
import OpenAI from 'openai';

const PRETTIFY_SYSTEM_PROMPT = `You are a note-taking assistant. Convert the transcribed voice note into well-structured HTML.

Rules:
- Use ONLY these tags: <h1>, <h2>, <h3>, <p>, <strong>, <em>, <ul>, <li>, <ol>, <code>, <pre><code>, <blockquote>
- Do NOT include <html>, <head>, <body>, <div>, or any wrapper tags
- Output only the inner HTML fragment — nothing else, no markdown fences
- Preserve ALL information from the transcript — do not summarize or omit anything
- Add structure where it makes content clearer:
  - Use headings for distinct topics
  - Use bullet lists for enumerations or items mentioned
  - Use numbered lists for steps or sequences
  - Use <strong> for emphasis or key terms the speaker stressed
  - Use <em> for asides or softer emphasis
  - Use <code> for anything that sounds like code, commands, or technical terms
  - Use <blockquote> for quotes or something the speaker is citing
- If the speaker mentions a time or date (e.g. "at 3pm", "tomorrow"), wrap it in <strong>
- Start with a short <h2> summarizing the main theme if there are multiple topics`;

// POST /api/notes/transcribe
// Body: multipart/form-data — fields: audio (File), provider ('openai'|'gemini'), model (string)
// Returns: { html, rawTranscription }
export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const provider  = (formData.get('provider') as string) || 'openai';
    const model     = (formData.get('model')    as string) || '';

    if (!audioFile) return apiError(ErrorCode.VALIDATION_ERROR, 'audio field is required');

    if (provider === 'gemini') {
      return await handleGemini(audioFile, model);
    }
    return await handleOpenAI(audioFile, model);

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

async function handleOpenAI(audioFile: File, modelOverride: string) {
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
  const completion = await openai.chat.completions.create({
    model: prettifyModel,
    messages: [
      { role: 'system', content: PRETTIFY_SYSTEM_PROMPT },
      { role: 'user',   content: `Transcription:\n${rawText}` },
    ],
    temperature: 0.3,
  });

  const html = completion.choices[0]?.message?.content?.trim() || `<p>${rawText}</p>`;
  return NextResponse.json({ html, rawTranscription: rawText });
}

// ─── Gemini: audio → transcription + prettification in one call ───────────────
// Gemini 2.0 Flash natively understands audio — no separate transcription step needed.

async function handleGemini(audioFile: File, modelOverride: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return apiError(ErrorCode.INTERNAL_ERROR, 'Gemini API key not configured');

  const modelId = modelOverride || 'gemini-2.0-flash';

  // Convert audio file to base64
  const arrayBuffer = await audioFile.arrayBuffer();
  const base64Audio = Buffer.from(arrayBuffer).toString('base64');
  const mimeType = audioFile.type || 'audio/webm';

  const prompt = `${PRETTIFY_SYSTEM_PROMPT}

Listen to this audio recording and transcribe it, then immediately format the transcription as structured HTML following the rules above. Do not describe the audio — just transcribe what is said and format it.`;

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
