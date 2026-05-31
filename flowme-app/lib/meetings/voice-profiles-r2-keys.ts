// R2 layout for voice profile reference clips.
// Stored under a dedicated prefix so they can be excluded from the meeting
// retention policy (voice profiles are kept until the user removes them).

export function voiceProfileKey(userId: string, personId: string, ext: string): string {
  const cleanExt = ext.replace(/^\./, '').replace(/[^a-zA-Z0-9]/g, '');
  return `voice-profiles/${userId}/${personId}.${cleanExt || 'webm'}`;
}
