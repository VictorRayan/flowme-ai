import fs from 'fs';
import path from 'path';

function debugLog(line: string): void {
  try {
    const file = path.join(process.cwd(), 'transcribe_debug.log');
    fs.appendFileSync(file, `${new Date().toISOString()} ${line}\n`);
  } catch {
    // ignore — logging is best effort
  }
}

export interface IncomingAttachment {
  type: 'image' | 'file' | 'audio';
  name: string;
  dataUrl: string;
  mimeType: string;
}

export interface IncomingMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: IncomingAttachment[];
}

export interface PreparedMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: IncomingAttachment[];
}

function inferAudioFilename(att: IncomingAttachment): string {
  const supplied = (att.name || '').trim();
  const hasExt = /\.(webm|mp3|mp4|m4a|wav|ogg|oga|flac|mpga|mpeg)$/i.test(supplied);
  if (supplied && hasExt) return supplied;

  const mt = (att.mimeType || '').toLowerCase();
  if (mt.includes('webm')) return 'audio.webm';
  if (mt.includes('mp4') || mt.includes('m4a')) return 'audio.m4a';
  if (mt.includes('mpeg') || mt.includes('mp3')) return 'audio.mp3';
  if (mt.includes('wav')) return 'audio.wav';
  if (mt.includes('ogg')) return 'audio.ogg';
  if (mt.includes('flac')) return 'audio.flac';
  return 'audio.webm';
}

const GEMINI_TRANSCRIBE_MODEL = process.env.BALYS_TRANSCRIBE_MODEL_GEMINI || 'gemini-2.5-flash';
const TRANSCRIBE_PROMPT = `Transcribe this audio recording exactly. Return ONLY the spoken words as plain text. No prefix, no quotes, no explanation, no language note. If the audio is silent or unintelligible, return an empty string.`;

async function transcribeViaGemini(buffer: Buffer, contentType: string): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, reason: 'GEMINI_API_KEY not configured' };

  const base64Audio = buffer.toString('base64');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TRANSCRIBE_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { inline_data: { mime_type: contentType, data: base64Audio } },
          { text: TRANSCRIBE_PROMPT },
        ],
      },
    ],
    generationConfig: { temperature: 0 },
  };

  debugLog(`POST gemini model=${GEMINI_TRANSCRIBE_MODEL} bytes=${buffer.length} contentType=${contentType}`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      debugLog(`Gemini HTTP ${res.status} ${res.statusText} body=${errText.slice(0, 800)}`);
      return { ok: false, reason: `gemini HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }

    const data = await res.json();
    const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    if (!text) {
      debugLog(`Gemini returned empty text. raw=${JSON.stringify(data).slice(0, 400)}`);
      return { ok: false, reason: 'gemini returned empty transcript' };
    }
    debugLog(`Gemini OK chars=${text.length} preview=${text.slice(0, 120)}`);
    return { ok: true, text };
  } catch (e) {
    const reason = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    debugLog(`Gemini fetch threw: ${reason}`);
    return { ok: false, reason };
  }
}

async function transcribeViaWhisper(buffer: Buffer, filename: string, contentType: string): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, reason: 'OPENAI_API_KEY not configured' };

  try {
    const blob = new Blob([new Uint8Array(buffer)], { type: contentType });
    const form = new FormData();
    form.append('file', blob, filename);
    form.append('model', 'whisper-1');
    form.append('response_format', 'text');

    debugLog(`POST whisper filename=${filename} bytes=${buffer.length}`);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!response.ok) {
      const bodyText = await response.text();
      debugLog(`Whisper HTTP ${response.status} ${response.statusText} body=${bodyText.slice(0, 800)}`);
      return { ok: false, reason: `whisper HTTP ${response.status}: ${bodyText.slice(0, 200)}` };
    }

    const text = (await response.text()).trim();
    if (!text) return { ok: false, reason: 'whisper returned empty transcript' };
    debugLog(`Whisper OK chars=${text.length} preview=${text.slice(0, 120)}`);
    return { ok: true, text };
  } catch (e) {
    const reason = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    debugLog(`Whisper fetch threw: ${reason}`);
    return { ok: false, reason };
  }
}

async function transcribeAudio(att: IncomingAttachment): Promise<string> {
  debugLog(`incoming attachment: name=${att.name} mimeType=${att.mimeType} dataUrlLength=${(att.dataUrl || '').length}`);

  const base64 = (att.dataUrl || '').split(',')[1];
  if (!base64) {
    debugLog(`empty base64 after split. dataUrl prefix=${(att.dataUrl || '').slice(0, 80)}`);
    return '[Audio transcription failed: empty audio payload]';
  }

  const buffer = Buffer.from(base64, 'base64');
  const filename = inferAudioFilename(att);
  const contentType = att.mimeType || 'audio/webm';

  debugLog(`prepared buffer bytes=${buffer.length} filename=${filename} contentType=${contentType}`);

  if (buffer.length === 0) {
    return '[Audio transcription failed: decoded buffer is empty]';
  }

  const whisper = await transcribeViaWhisper(buffer, filename, contentType);
  if (whisper.ok) return whisper.text;

  debugLog(`Whisper failed (${whisper.reason}); falling back to Gemini`);

  const gemini = await transcribeViaGemini(buffer, contentType);
  if (gemini.ok) return gemini.text;

  debugLog(`Both providers failed. whisper=${whisper.reason} gemini=${gemini.reason}`);
  return `[Audio transcription failed: ${whisper.reason}; gemini fallback: ${gemini.reason}]`;
}

function decodeFileText(att: IncomingAttachment): string {
  try {
    const base64 = att.dataUrl.split(',')[1];
    if (!base64) return '';
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

export async function prepareMessagesWithAttachments(messages: IncomingMessage[]): Promise<PreparedMessage[]> {
  const prepared: PreparedMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'assistant' || !msg.attachments || msg.attachments.length === 0) {
      prepared.push({ role: msg.role, content: msg.content || '', attachments: msg.attachments });
      continue;
    }

    const inlineParts: string[] = [];
    const remainingAttachments: IncomingAttachment[] = [];

    for (const att of msg.attachments) {
      if (att.type === 'audio') {
        const text = await transcribeAudio(att);
        if (text) inlineParts.push(text);
      } else if (att.type === 'file') {
        const text = decodeFileText(att);
        if (text) inlineParts.push(`[File: ${att.name}]\n${text}`);
        else inlineParts.push(`[File: ${att.name}]`);
      } else if (att.type === 'image') {
        remainingAttachments.push(att);
      }
    }

    const mergedContent = [msg.content, ...inlineParts].filter((s) => s && s.trim().length > 0).join('\n\n');

    prepared.push({
      role: msg.role,
      content: mergedContent,
      attachments: remainingAttachments.length > 0 ? remainingAttachments : undefined,
    });
  }

  return prepared;
}

export function extractLatestUserText(messages: PreparedMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user' && messages[i].content) return messages[i].content;
  }
  return '';
}
