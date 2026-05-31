// Pure JSON parsing + validation for transcription/diarization adapter outputs.
// Used by both the Gemini and OpenAI adapters and by tests.

import type { DiarizedSegment } from './types';

export interface ParsedDiarization {
  segments: DiarizedSegment[];
  detectedLanguage: string;
}

export function parseDiarizedJson(raw: string): ParsedDiarization {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Empty diarization response');
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch { parsed = null; }
    }
  }
  if (!parsed) throw new Error('Diarization response was not valid JSON');

  const rawSegments = Array.isArray(parsed?.segments) ? parsed.segments : [];
  if (rawSegments.length === 0) throw new Error('Diarization response had zero segments');

  const segments: DiarizedSegment[] = [];
  for (const item of rawSegments) {
    if (!item || typeof item !== 'object') continue;
    const speaker = String(item.speaker || item.providerLabel || '').trim().toUpperCase();
    if (!speaker) continue;
    const startSeconds = toNumber(item.start_s ?? item.startSeconds ?? item.start);
    const endSeconds = toNumber(item.end_s ?? item.endSeconds ?? item.end);
    const text = String(item.text || '').trim();
    if (!text) continue;
    if (Number.isNaN(startSeconds) || Number.isNaN(endSeconds)) continue;
    if (endSeconds < startSeconds) continue;
    segments.push({ providerLabel: speaker, startSeconds, endSeconds, text });
  }
  if (segments.length === 0) throw new Error('No valid segments after parsing');

  // Reject names: providerLabel must be a short label like A, B, C...
  for (const seg of segments) {
    if (!/^[A-Z](?:[0-9]+)?$/.test(seg.providerLabel)) {
      throw new Error(`Provider returned a real-looking name as speaker label: ${seg.providerLabel}`);
    }
  }

  const detectedLanguage = String(parsed.detected_language || parsed.detectedLanguage || 'pt');
  return { segments, detectedLanguage };
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : Number.NaN;
  }
  return Number.NaN;
}

export function mergeAdjacentSameSpeaker(segments: DiarizedSegment[]): DiarizedSegment[] {
  if (segments.length <= 1) return [...segments];
  const out: DiarizedSegment[] = [];
  for (const seg of segments) {
    const last = out[out.length - 1];
    if (last && last.providerLabel === seg.providerLabel && seg.startSeconds - last.endSeconds <= 1.5) {
      out[out.length - 1] = {
        providerLabel: last.providerLabel,
        startSeconds: last.startSeconds,
        endSeconds: seg.endSeconds,
        text: `${last.text} ${seg.text}`.trim(),
      };
    } else {
      out.push({ ...seg });
    }
  }
  return out;
}
