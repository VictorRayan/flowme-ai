import { voiceProfileKey } from '@/lib/meetings/voice-profiles-r2-keys';

describe('voiceProfileKey', () => {
  it('namespaces voice profiles by user id and person id', () => {
    expect(voiceProfileKey('u1', 'p1', 'webm')).toBe('voice-profiles/u1/p1.webm');
  });
  it('sanitizes the extension and falls back to webm', () => {
    expect(voiceProfileKey('u1', 'p1', '.MP3')).toBe('voice-profiles/u1/p1.MP3');
    expect(voiceProfileKey('u1', 'p1', '')).toBe('voice-profiles/u1/p1.webm');
    expect(voiceProfileKey('u1', 'p1', '../etc')).toBe('voice-profiles/u1/p1.etc');
  });
});
