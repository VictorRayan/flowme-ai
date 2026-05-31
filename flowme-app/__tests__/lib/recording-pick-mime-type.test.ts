import { pickSupportedAudioMimeTypeFromList } from '@/lib/recording/pick-mime-type';

describe('pickSupportedAudioMimeTypeFromList', () => {
  it('returns the first supported candidate (Chromium webm/opus path)', () => {
    const out = pickSupportedAudioMimeTypeFromList((m) => m === 'audio/webm;codecs=opus' || m === 'audio/webm');
    expect(out).toBe('audio/webm;codecs=opus');
  });

  it('falls through to audio/mp4 for Safari', () => {
    const out = pickSupportedAudioMimeTypeFromList((m) => m === 'audio/mp4');
    expect(out).toBe('audio/mp4');
  });

  it('returns the first candidate when nothing is supported (lets the recorder fail gracefully)', () => {
    const out = pickSupportedAudioMimeTypeFromList(() => false);
    expect(out).toBe('audio/webm;codecs=opus');
  });
});
