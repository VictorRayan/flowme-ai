// Pick a MediaRecorder MIME type that the current browser actually supports.
// Safari needs audio/mp4; Chromium prefers audio/webm;codecs=opus.

const CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/mpeg',
];

export function pickSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return CANDIDATES[0];
  for (const candidate of CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) return candidate;
    } catch {
      // ignore — fallthrough
    }
  }
  return CANDIDATES[0];
}

export function pickSupportedAudioMimeTypeFromList(
  isSupported: (m: string) => boolean,
  candidates: string[] = CANDIDATES,
): string {
  for (const c of candidates) if (isSupported(c)) return c;
  return candidates[0];
}
