// TranscriptionDiarizationAdapter contract + Gemini-first router with OpenAI fallback.
// See docs/13-meeting-recording-diarization-plan.md §5.1.

import { downloadFromR2 } from '@/lib/r2/storage';
import type { DiarizedSegment, TranscriptionInput, TranscriptionResult } from './types';
import { parseDiarizedJson, mergeAdjacentSameSpeaker } from './diarization-parser';

export interface TranscriptionDiarizationAdapter {
  transcribeWithDiarization(input: TranscriptionInput): Promise<TranscriptionResult>;
}

const DIARIZATION_PROMPT = `You are a meeting transcription assistant.

Transcribe the audio in the user's language and diarize it (separate the speakers).

OUTPUT FORMAT — STRICT JSON, no markdown, no commentary, no extra fields:
{
  "detected_language": "pt" | "en",
  "segments": [
    {
      "speaker": "A",
      "start_s": 0.0,
      "end_s": 4.2,
      "text": "..."
    }
  ]
}

RULES:
- "speaker" must be a short label: A, B, C, ... It must NEVER be a real
  person's name, even if the participants list suggests one.
- Maintain consistent speaker labels across the whole meeting.
- Use the participants hint only to help separate voices, not to assign
  identities.
- Provide accurate start_s and end_s in seconds.
- Strip filler words minimally; do not paraphrase.
- Return JSON only.`;

function adapterPromptWithHints(participantsHint?: string[]): string {
  if (!participantsHint || participantsHint.length === 0) return DIARIZATION_PROMPT;
  return DIARIZATION_PROMPT + `\n\nPARTICIPANTS HINT (do not assign names, just help separate voices): ${participantsHint.join(', ')}`;
}

// ──────────────────────────────────────────────────────────────────────────
// Gemini adapter (primary)
// ──────────────────────────────────────────────────────────────────────────

export interface GeminiAdapterOptions {
  modelForLongMeetings?: string;
  modelForShortMeetings?: string;
  longMeetingThresholdSeconds?: number;
  fetchAudio?: (key: string) => Promise<{ data: Uint8Array; mimeType: string }>;
  callGemini?: (opts: { model: string; promptText: string; audio: { data: Uint8Array; mimeType: string } }) => Promise<string>;
}

export function geminiDiarizationAdapter(options: GeminiAdapterOptions = {}): TranscriptionDiarizationAdapter {
  const longModel = options.modelForLongMeetings || 'gemini-2.5-pro';
  const shortModel = options.modelForShortMeetings || 'gemini-2.5-flash';
  const threshold = options.longMeetingThresholdSeconds ?? 300;
  const fetchAudio = options.fetchAudio || defaultFetchAudio;
  const callGemini = options.callGemini || defaultCallGemini;

  return {
    async transcribeWithDiarization(input: TranscriptionInput): Promise<TranscriptionResult> {
      const audio = await fetchAudio(input.audioR2Key);
      const expectedDurationSeconds = (input.expectedSpeakerCount || 0) > 0 ? threshold + 1 : threshold + 1; // we default to long unless caller knows it's short
      const model = expectedDurationSeconds > threshold ? longModel : shortModel;
      const promptText = adapterPromptWithHints(input.participantsHint);
      const raw = await callGemini({ model, promptText, audio: { data: audio.data, mimeType: input.audioMimeType || audio.mimeType } });
      const parsed = parseDiarizedJson(raw);
      const segments = mergeAdjacentSameSpeaker(parsed.segments);
      return {
        segments,
        detectedLanguage: parsed.detectedLanguage,
        providerName: 'gemini',
        providerReceiptId: null,
      };
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// OpenAI adapter (fallback)
// ──────────────────────────────────────────────────────────────────────────

export interface OpenAIAdapterOptions {
  model?: string;
  fetchAudio?: (key: string) => Promise<{ data: Uint8Array; mimeType: string }>;
  callOpenAI?: (opts: { model: string; audio: { data: Uint8Array; mimeType: string } }) => Promise<{ raw: string; receiptId: string | null }>;
}

export function openAIDiarizationAdapter(options: OpenAIAdapterOptions = {}): TranscriptionDiarizationAdapter {
  const model = options.model || 'gpt-4o-transcribe-diarize';
  const fetchAudio = options.fetchAudio || defaultFetchAudio;
  const callOpenAI = options.callOpenAI || defaultCallOpenAI;

  return {
    async transcribeWithDiarization(input: TranscriptionInput): Promise<TranscriptionResult> {
      const audio = await fetchAudio(input.audioR2Key);
      const result = await callOpenAI({ model, audio: { data: audio.data, mimeType: input.audioMimeType || audio.mimeType } });
      const parsed = parseDiarizedJson(result.raw);
      const segments = mergeAdjacentSameSpeaker(parsed.segments);
      return {
        segments,
        detectedLanguage: parsed.detectedLanguage,
        providerName: 'openai',
        providerReceiptId: result.receiptId,
      };
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Router: Gemini primary, OpenAI fallback, with reason reporting.
// ──────────────────────────────────────────────────────────────────────────

export interface RoutedTranscriptionResult extends TranscriptionResult {
  fallbackReason: string | null;
}

export interface AdapterRouterOptions {
  primary?: TranscriptionDiarizationAdapter;
  fallback?: TranscriptionDiarizationAdapter;
}

export function routedDiarizationAdapter(opts: AdapterRouterOptions = {}): {
  transcribeWithDiarization(input: TranscriptionInput): Promise<RoutedTranscriptionResult>;
} {
  const primary = opts.primary || geminiDiarizationAdapter();
  const fallback = opts.fallback || openAIDiarizationAdapter();

  return {
    async transcribeWithDiarization(input: TranscriptionInput): Promise<RoutedTranscriptionResult> {
      try {
        const result = await primary.transcribeWithDiarization(input);
        if (result.segments.length === 0) throw new Error('gemini_zero_segments');
        return { ...result, fallbackReason: null };
      } catch (primaryErr) {
        const code = classifyError(primaryErr);
        const result = await fallback.transcribeWithDiarization(input);
        return { ...result, fallbackReason: code };
      }
    },
  };
}

function classifyError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/timeout/i.test(message) || /ETIMEDOUT/i.test(message)) return 'gemini_timeout';
  if (/real-looking name/i.test(message)) return 'gemini_invented_name';
  if (/zero[ _-]segments/i.test(message) || /No valid segments/i.test(message)) return 'gemini_zero_segments';
  if (/(invalid|not valid)\s+(JSON|json)/i.test(message) || /not valid JSON/i.test(message)) return 'gemini_invalid_json';
  return 'gemini_error';
}

// ──────────────────────────────────────────────────────────────────────────
// Default IO implementations (mocked in tests)
// ──────────────────────────────────────────────────────────────────────────

async function defaultFetchAudio(key: string): Promise<{ data: Uint8Array; mimeType: string }> {
  const res = await downloadFromR2(key);
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) parts.push(value);
  }
  const total = parts.reduce((acc, p) => acc + p.byteLength, 0);
  const data = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) { data.set(p, offset); offset += p.byteLength; }
  return { data, mimeType: res.contentType };
}

async function defaultCallGemini(opts: { model: string; promptText: string; audio: { data: Uint8Array; mimeType: string } }): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: opts.model, generationConfig: { responseMimeType: 'application/json' } });
  const audioPart = {
    inlineData: {
      data: Buffer.from(opts.audio.data).toString('base64'),
      mimeType: opts.audio.mimeType,
    },
  };
  const result = await model.generateContent([opts.promptText, audioPart as any]);
  const response: any = result.response;
  return response?.text?.() || '';
}

async function defaultCallOpenAI(opts: { model: string; audio: { data: Uint8Array; mimeType: string } }): Promise<{ raw: string; receiptId: string | null }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const OpenAIModule = await import('openai');
  const OpenAI = (OpenAIModule.default || (OpenAIModule as any).OpenAI) as any;
  const client = new OpenAI({ apiKey });
  const file = new File([opts.audio.data as any], 'meeting.audio', { type: opts.audio.mimeType });
  const result: any = await client.audio.transcriptions.create({
    file,
    model: opts.model,
    response_format: 'diarized_json' as any,
  });
  // OpenAI returns { segments, language } when diarized_json is requested.
  const wrapper = {
    detected_language: result.language || 'pt',
    segments: Array.isArray(result.segments) ? result.segments : [],
  };
  return { raw: JSON.stringify(wrapper), receiptId: result.id || null };
}

// Re-export for adapter consumers
export type { DiarizedSegment };
