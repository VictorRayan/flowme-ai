import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';
import OpenAI from 'openai';

// POST /api/notes/transcribe
// Body: multipart/form-data with `audio` field (webm/ogg blob from MediaRecorder)
// Returns: { html: string } — transcription prettified as structured HTML for TipTap
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    if (!process.env.OPENAI_API_KEY) {
      return apiError(ErrorCode.INTERNAL_ERROR, 'OpenAI API key not configured');
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    if (!audioFile) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'audio field is required');
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Phase 1 — Whisper transcription
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'text',
    });

    const rawText = typeof transcription === 'string' ? transcription : (transcription as { text: string }).text;

    if (!rawText?.trim()) {
      return NextResponse.json({ html: '<p></p>' });
    }

    // Phase 2 — GPT-4o prettification into structured HTML
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a note-taking assistant. Convert the transcribed voice note into well-structured HTML.

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
- Start with a short <h2> summarizing the main theme if there are multiple topics`,
        },
        {
          role: 'user',
          content: `Transcription:\n${rawText}`,
        },
      ],
      temperature: 0.3,
    });

    const html = completion.choices[0]?.message?.content?.trim() || `<p>${rawText}</p>`;

    return NextResponse.json({ html, rawTranscription: rawText });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[notes/transcribe] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
