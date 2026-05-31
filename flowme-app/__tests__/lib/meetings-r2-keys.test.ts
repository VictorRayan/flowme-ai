import {
  meetingChunkKey,
  meetingFinalAudioKey,
  meetingCorrectionKey,
  meetingChunkPrefix,
  meetingPrefix,
  isAllowedAudioMimeType,
  extForMimeType,
} from '@/lib/meetings/r2-keys';

describe('meetings r2-keys', () => {
  it('pads chunk sequence numbers and sanitizes the extension', () => {
    expect(meetingChunkKey('m1', 1, 'webm')).toBe('meetings/m1/chunks/00001.webm');
    expect(meetingChunkKey('m1', 12345, '.MP3')).toBe('meetings/m1/chunks/12345.MP3');
    expect(meetingChunkKey('m1', 7, '../etc')).toBe('meetings/m1/chunks/00007.etc');
  });

  it('builds the final audio key once Stage 1 finishes', () => {
    expect(meetingFinalAudioKey('m1', 'mp3')).toBe('meetings/m1/audio.mp3');
    expect(meetingFinalAudioKey('m1', '')).toBe('meetings/m1/audio.webm');
  });

  it('namespaces correction audios separately from chunks', () => {
    expect(meetingCorrectionKey('m1', 1, 'webm')).toBe('meetings/m1/corrections/001.webm');
    expect(meetingChunkPrefix('m1')).toBe('meetings/m1/chunks/');
    expect(meetingPrefix('m1')).toBe('meetings/m1/');
  });

  it('accepts the audio mime types the recorder produces', () => {
    expect(isAllowedAudioMimeType('audio/webm')).toBe(true);
    expect(isAllowedAudioMimeType('audio/webm;codecs=opus')).toBe(true);
    expect(isAllowedAudioMimeType('audio/mp4')).toBe(true);
    expect(isAllowedAudioMimeType('audio/wav')).toBe(true);
    expect(isAllowedAudioMimeType('video/mp4')).toBe(false);
    expect(isAllowedAudioMimeType('text/plain')).toBe(false);
  });

  it('maps mime to a stable extension', () => {
    expect(extForMimeType('audio/webm')).toBe('webm');
    expect(extForMimeType('audio/webm;codecs=opus')).toBe('webm');
    expect(extForMimeType('audio/mp4')).toBe('m4a');
    expect(extForMimeType('audio/wav')).toBe('wav');
    expect(extForMimeType('audio/unknown')).toBe('webm');
  });
});
