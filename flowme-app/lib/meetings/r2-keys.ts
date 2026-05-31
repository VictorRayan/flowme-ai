// R2 key conventions for meeting audio.
// Layout (private bucket):
//   meetings/<meetingId>/chunks/<seq>.<ext>   temporary, deleted ~1h after assembly
//   meetings/<meetingId>/audio.<ext>          DURABLE (durability boundary 1)
//   meetings/<meetingId>/corrections/<seq>.<ext>  correction audios

export function meetingChunkKey(meetingId: string, sequenceNumber: number, ext: string): string {
  const cleanExt = ext.replace(/^\./, '').replace(/[^a-zA-Z0-9]/g, '');
  return `meetings/${meetingId}/chunks/${String(sequenceNumber).padStart(5, '0')}.${cleanExt || 'webm'}`;
}

export function meetingFinalAudioKey(meetingId: string, ext: string): string {
  const cleanExt = ext.replace(/^\./, '').replace(/[^a-zA-Z0-9]/g, '');
  return `meetings/${meetingId}/audio.${cleanExt || 'webm'}`;
}

export function meetingCorrectionKey(meetingId: string, sequenceNumber: number, ext: string): string {
  const cleanExt = ext.replace(/^\./, '').replace(/[^a-zA-Z0-9]/g, '');
  return `meetings/${meetingId}/corrections/${String(sequenceNumber).padStart(3, '0')}.${cleanExt || 'webm'}`;
}

export function meetingChunkPrefix(meetingId: string): string {
  return `meetings/${meetingId}/chunks/`;
}

export function meetingPrefix(meetingId: string): string {
  return `meetings/${meetingId}/`;
}

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/m4a',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
]);

export function isAllowedAudioMimeType(mimeType: string): boolean {
  return ALLOWED_AUDIO_MIME_TYPES.has(mimeType.toLowerCase().trim());
}

export function extForMimeType(mimeType: string): string {
  const m = mimeType.toLowerCase().split(';')[0].trim();
  switch (m) {
    case 'audio/webm': return 'webm';
    case 'audio/ogg': return 'ogg';
    case 'audio/mp4':
    case 'audio/m4a': return 'm4a';
    case 'audio/mpeg':
    case 'audio/mp3': return 'mp3';
    case 'audio/wav':
    case 'audio/x-wav': return 'wav';
    default: return 'webm';
  }
}
