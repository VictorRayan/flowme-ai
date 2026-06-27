import OpenAI from 'openai';
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';
import { parseChecklistText } from '@/lib/checklists/parser';

async function transcribeWithOpenAI(audioFile: File): Promise<string> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    language: 'pt',
    response_format: 'text',
  });
  return typeof transcription === 'string' ? transcription : String(transcription || '');
}

async function transcribeWithGemini(audioFile: File): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key not configured');
  const arrayBuffer = await audioFile.arrayBuffer();
  const base64Audio = Buffer.from(arrayBuffer).toString('base64');
  const mimeType = audioFile.type || 'audio/webm';
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { inline_data: { mime_type: mimeType, data: base64Audio } },
        { text: 'Transcreva este áudio em português. Retorne somente o texto falado, sem comentários.' },
      ],
    }],
    generationConfig: { temperature: 0.1 },
  };
  const modelId = process.env.CHECKLIST_TRANSCRIBE_MODEL_GEMINI || 'gemini-2.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const raw = await response.text();
    let message = 'Gemini transcription failed';
    try {
      const parsed = JSON.parse(raw);
      message = parsed?.error?.message || message;
    } catch {}
    throw new Error(message);
  }
  const payload = await response.json();
  return payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('').trim() || '';
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;
    if (!audioFile) return apiError(ErrorCode.VALIDATION_ERROR, 'audio field is required', 400);
    if (audioFile.size === 0) return apiError(ErrorCode.VALIDATION_ERROR, 'Recorded audio was empty. Try recording again.', 400);

    let text = '';
    try {
      text = await transcribeWithOpenAI(audioFile);
    } catch (openAiError: unknown) {
      console.warn('[checklists/transcribe] OpenAI failed, trying Gemini:', openAiError instanceof Error ? openAiError.message : openAiError);
      text = await transcribeWithGemini(audioFile);
    }
    if (!text.trim()) return apiError(ErrorCode.INTERNAL_ERROR, 'Could not understand the checklist audio. Try a slightly longer recording.', 500);
    const parsed = parseChecklistText(text);
    return apiSuccess({ text, checklist: parsed });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    const message = err instanceof Error ? err.message : 'Failed to transcribe checklist audio';
    console.error('[checklists/transcribe] failed:', message);
    return apiError(ErrorCode.INTERNAL_ERROR, message, 500);
  }
}
