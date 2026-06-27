import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';
import OpenAI from 'openai';
import { estimateTokensFromText, logAiUsage } from '@/lib/ai/billing';

const PRETTIFY_SYSTEM_PROMPT = `You are a note-taking assistant. Your job is to transcribe a new voice recording and append it to an existing note as structured HTML.

Rules:
- Use ONLY these tags: <h1>, <h2>, <h3>, <p>, <strong>, <em>, <ul>, <li>, <ol>, <code>, <pre><code>, <blockquote>, <hr>
- Do NOT include <html>, <head>, <body>, <div>, or any wrapper tags
- Output only the inner HTML fragment for the NEW content to append, nothing else
- DO NOT repeat or rewrite the existing note content, only output the new section
- Preserve ALL information from the new transcript, do not summarize or omit anything
- Use the existing note content as context to maintain consistent terminology, topics, and tone
- If the new recording continues or expands a topic already in the note, structure it accordingly
- Add structure where it makes content clearer:
  - Use headings for distinct topics
  - Use bullet lists for enumerations or items mentioned
  - Use numbered lists for steps or sequences
  - Use <strong> for emphasis or key terms
  - Use <em> for softer emphasis
  - Use <code> for technical terms or commands
  - Use <blockquote> for quoted content
- If the speaker mentions a time or date (e.g. "at 3pm", "tomorrow"), wrap it in <strong>
- Start the new section with an <hr> separator, then a short <h2> summarizing the new recording's main theme`;

// Default path: Whisper transcribes the audio, then the newest Gemini Flash
// formats the transcript into structured HTML. Gemini Flash beats the older
// Gemini Pro on this task at a fraction of the cost. Overridable via env.
const NOTES_FORMAT_MODEL = process.env.NOTES_FORMAT_MODEL || 'gemini-3-flash-preview';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const provider = ((formData.get('provider') as string) || 'openai') as 'openai' | 'gemini';
    const model = (formData.get('model') as string) || '';
    const existingContent = (formData.get('existingContent') as string) || '';

    if (!audioFile) return apiError(ErrorCode.VALIDATION_ERROR, 'audio field is required');

    if (provider === 'gemini') {
      return await handleGemini(auth, audioFile, model, existingContent);
    }
    return await handleOpenAI(auth, audioFile, model, existingContent);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[notes/transcribe] error:', msg);
    if (msg === ErrorCode.UNAUTHORIZED) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function handleOpenAI(auth: { supabase: any; user: any }, audioFile: File, modelOverride: string, existingContent: string) {
  if (!process.env.OPENAI_API_KEY) {
    return apiError(ErrorCode.INTERNAL_ERROR, 'OpenAI API key not configured');
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    response_format: 'text',
  });
  const rawText = typeof transcription === 'string'
    ? transcription
    : (transcription as { text: string }).text;

  if (!rawText?.trim()) return NextResponse.json({ html: '<p></p>', rawTranscription: '' });

  const userContent = existingContent?.trim()
    ? `Existing note content (for context only, do NOT repeat it):\n${existingContent}\n\n---\n\nNew transcription to append:\n${rawText}`
    : `Transcription:\n${rawText}`;

  const html = await formatTranscript(auth, {
    userContent,
    rawText,
    hasExistingContext: Boolean(existingContent?.trim()),
    openai,
    openaiModelOverride: modelOverride,
  });

  return NextResponse.json({ html, rawTranscription: rawText });
}

// Format the Whisper transcript into structured HTML. Primary path is the
// newest Gemini Flash; if Gemini is unavailable or errors, fall back to OpenAI
// so a recording is never lost.
async function formatTranscript(
  auth: { supabase: any; user: any },
  args: { userContent: string; rawText: string; hasExistingContext: boolean; openai: OpenAI; openaiModelOverride: string },
): Promise<string> {
  if (process.env.GEMINI_API_KEY) {
    try {
      const formatted = await geminiFormat(args.userContent);
      await logAiUsage({
        supabase: auth.supabase,
        user: auth.user,
        feature: 'transcribe',
        provider: 'gemini',
        model: NOTES_FORMAT_MODEL,
        promptTokens: formatted.promptTokens,
        completionTokens: formatted.completionTokens,
        metadata: {
          usage_source: formatted.usageSource,
          has_existing_context: args.hasExistingContext,
          transcription_chars: args.rawText.length,
          step: 'format',
        },
      });
      return formatted.html;
    } catch (err) {
      console.error('[notes/transcribe] Gemini formatting failed, falling back to OpenAI:', err instanceof Error ? err.message : err);
    }
  }

  const prettifyModel = args.openaiModelOverride || 'gpt-4o-mini';
  const completion = await args.openai.chat.completions.create({
    model: prettifyModel,
    messages: [
      { role: 'system', content: PRETTIFY_SYSTEM_PROMPT },
      { role: 'user', content: args.userContent },
    ],
    temperature: 0.3,
  });

  const html = completion.choices[0]?.message?.content?.trim() || `<p>${args.rawText}</p>`;

  await logAiUsage({
    supabase: auth.supabase,
    user: auth.user,
    feature: 'transcribe',
    provider: 'openai',
    model: prettifyModel,
    promptTokens: completion.usage?.prompt_tokens ?? estimateTokensFromText(PRETTIFY_SYSTEM_PROMPT + args.userContent),
    completionTokens: completion.usage?.completion_tokens ?? estimateTokensFromText(html),
    metadata: {
      usage_source: completion.usage ? 'api' : 'estimated',
      has_existing_context: args.hasExistingContext,
      transcription_chars: args.rawText.length,
      step: 'format_fallback',
    },
  });

  return html;
}

async function geminiFormat(userContent: string): Promise<{ html: string; promptTokens: number; completionTokens: number; usageSource: 'api' | 'estimated' }> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const prompt = `${PRETTIFY_SYSTEM_PROMPT}\n\n${userContent}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3 },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${NOTES_FORMAT_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Gemini format error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const data = await res.json();
  const html = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!html) throw new Error('Gemini returned empty formatting');

  const usage = data?.usageMetadata;
  return {
    html,
    promptTokens: usage?.promptTokenCount ?? estimateTokensFromText(prompt),
    completionTokens: usage?.candidatesTokenCount ?? estimateTokensFromText(html),
    usageSource: usage ? 'api' : 'estimated',
  };
}

async function handleGemini(auth: { supabase: any; user: any }, audioFile: File, modelOverride: string, existingContent: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return apiError(ErrorCode.INTERNAL_ERROR, 'Gemini API key not configured');

  const modelId = modelOverride || 'gemini-2.5-flash';

  const arrayBuffer = await audioFile.arrayBuffer();
  const base64Audio = Buffer.from(arrayBuffer).toString('base64');
  const mimeType = audioFile.type || 'audio/webm';

  const contextBlock = existingContent?.trim()
    ? `\n\nExisting note content (for context only, do NOT repeat it):\n${existingContent}\n\n---\n\n`
    : '\n\n';

  const prompt = `${PRETTIFY_SYSTEM_PROMPT}${contextBlock}Listen to this audio recording and transcribe it, then immediately format the transcription as structured HTML to append to the note. Do not describe the audio, just transcribe and format.`;

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
    } catch {
      msg = errText;
    }
    return NextResponse.json({ error: msg }, { status: res.status });
  }

  const data = await res.json();
  const html = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '<p></p>';

  const usage = data?.usageMetadata;
  const promptTokens = usage?.promptTokenCount ?? estimateTokensFromText(prompt);
  const completionTokens = usage?.candidatesTokenCount ?? estimateTokensFromText(html);

  await logAiUsage({
    supabase: auth.supabase,
    user: auth.user,
    feature: 'transcribe',
    provider: 'gemini',
    model: modelId,
    promptTokens,
    completionTokens,
    metadata: {
      usage_source: usage ? 'api' : 'estimated',
      has_existing_context: Boolean(existingContent?.trim()),
      response_has_usage: Boolean(usage),
    },
  });

  return NextResponse.json({ html, rawTranscription: null });
}
