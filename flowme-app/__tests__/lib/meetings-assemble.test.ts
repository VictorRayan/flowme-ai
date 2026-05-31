import { assembleMeetingAudio } from '@/lib/meetings/assemble';

function fakeStream(bytes: number[]): ReadableStream {
  let sent = false;
  return new ReadableStream({
    pull(controller) {
      if (sent) { controller.close(); return; }
      sent = true;
      controller.enqueue(new Uint8Array(bytes));
    },
  });
}

describe('assembleMeetingAudio', () => {
  it('throws when there are no chunks to assemble', async () => {
    await expect(assembleMeetingAudio({ meetingId: 'm1', chunks: [] })).rejects.toThrow(/No chunks/);
  });

  it('orders chunks by sequence_number, runs ffmpeg, and uploads to the durable final-audio key', async () => {
    const downloaded: string[] = [];
    const ffmpegCalls: Array<{ args: string[]; ffmpegPath: string }> = [];
    const uploaded: { key: string; contentType: string; size: number }[] = [];

    const fakeDownload = jest.fn(async (key: string) => {
      downloaded.push(key);
      return { body: fakeStream([1, 2, 3]), contentType: 'audio/webm', contentLength: 3 };
    });

    const fakeRun = jest.fn(async (opts: { args: string[]; ffmpegPath: string }) => {
      ffmpegCalls.push(opts);
      // Pretend ffmpeg wrote the output file by reusing one of the input paths.
      // We do this by writing a tiny "fake" mp3 buffer to the output path argument.
      const outputPath = opts.args[opts.args.length - 1];
      const { writeFile } = await import('node:fs/promises');
      await writeFile(outputPath, Buffer.from([0xff, 0xfb, 0x90, 0x00]));
    });

    const fakeUpload = jest.fn(async (opts: any) => {
      uploaded.push({ key: opts.key, contentType: opts.contentType, size: opts.body.byteLength });
    });

    const out = await assembleMeetingAudio({
      meetingId: 'meet-1',
      chunks: [
        { sequenceNumber: 2, r2Key: 'meetings/meet-1/chunks/00002.webm', mimeType: 'audio/webm' },
        { sequenceNumber: 1, r2Key: 'meetings/meet-1/chunks/00001.webm', mimeType: 'audio/webm' },
        { sequenceNumber: 3, r2Key: 'meetings/meet-1/chunks/00003.webm', mimeType: 'audio/webm' },
      ],
      runFfmpeg: fakeRun,
      download: fakeDownload,
      upload: fakeUpload,
    });

    expect(downloaded).toEqual([
      'meetings/meet-1/chunks/00001.webm',
      'meetings/meet-1/chunks/00002.webm',
      'meetings/meet-1/chunks/00003.webm',
    ]);

    expect(ffmpegCalls).toHaveLength(1);
    const args = ffmpegCalls[0].args;
    expect(args).toContain('-f');
    expect(args).toContain('concat');
    expect(args).toContain('libmp3lame');

    expect(uploaded).toHaveLength(1);
    expect(uploaded[0].key).toBe('meetings/meet-1/audio.mp3');
    expect(uploaded[0].contentType).toBe('audio/mpeg');

    expect(out.finalAudioR2Key).toBe('meetings/meet-1/audio.mp3');
    expect(out.finalAudioMimeType).toBe('audio/mpeg');
    expect(out.outputBytes).toBeGreaterThan(0);
  });

  it('surfaces ffmpeg failures so the pipeline can mark failed_stage=assemble', async () => {
    const fakeDownload = jest.fn(async () => ({
      body: fakeStream([1, 2, 3]),
      contentType: 'audio/webm',
      contentLength: 3,
    }));
    const fakeRun = jest.fn(async () => { throw new Error('ffmpeg exited with code 1: bad input'); });
    const fakeUpload = jest.fn();

    await expect(assembleMeetingAudio({
      meetingId: 'meet-2',
      chunks: [{ sequenceNumber: 1, r2Key: 'meetings/meet-2/chunks/00001.webm', mimeType: 'audio/webm' }],
      runFfmpeg: fakeRun,
      download: fakeDownload,
      upload: fakeUpload,
    })).rejects.toThrow(/ffmpeg/);

    expect(fakeUpload).not.toHaveBeenCalled();
  });
});
