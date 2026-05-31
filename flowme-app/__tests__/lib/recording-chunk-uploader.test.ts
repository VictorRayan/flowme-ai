import { ChunkUploader } from '@/lib/recording/chunk-uploader';

function fakeBlob(size = 1024): Blob {
  return new Blob([new Uint8Array(size)], { type: 'audio/webm' });
}

describe('ChunkUploader', () => {
  it('uploads chunks one at a time and reports success in the snapshot', async () => {
    const adapter = {
      uploadChunk: jest.fn().mockResolvedValue({ ok: true }),
    };
    const uploader = new ChunkUploader({ meetingId: 'm1', adapter });
    uploader.enqueue({ sequenceNumber: 1, blob: fakeBlob(), mimeType: 'audio/webm', durationSeconds: 120 });
    uploader.enqueue({ sequenceNumber: 2, blob: fakeBlob(), mimeType: 'audio/webm', durationSeconds: 120 });
    await uploader.drain();
    expect(adapter.uploadChunk).toHaveBeenCalledTimes(2);
    expect(uploader.snapshot().uploaded).toBe(2);
    expect(uploader.snapshot().failed).toBe(0);
  });

  it('re-queues failed chunks so they retry on the next tick', async () => {
    const adapter = {
      uploadChunk: jest.fn()
        .mockResolvedValueOnce({ ok: false, error: 'http_500' })
        .mockResolvedValue({ ok: true }),
    };
    const uploader = new ChunkUploader({ meetingId: 'm1', adapter });
    uploader.enqueue({ sequenceNumber: 1, blob: fakeBlob(), mimeType: 'audio/webm', durationSeconds: 120 });
    await uploader.drain();
    expect(adapter.uploadChunk).toHaveBeenCalledTimes(2);
    expect(uploader.snapshot().uploaded).toBe(1);
    expect(uploader.snapshot().failed).toBe(1);
  });

  it('emits queue-change events so the UI can show pending/inflight badges', async () => {
    const adapter = {
      uploadChunk: jest.fn(async () => { await new Promise((r) => setTimeout(r, 10)); return { ok: true }; }),
    };
    const snapshots: any[] = [];
    const uploader = new ChunkUploader({ meetingId: 'm1', adapter, onQueueChange: (snap) => snapshots.push({ ...snap }) });
    uploader.enqueue({ sequenceNumber: 1, blob: fakeBlob(), mimeType: 'audio/webm', durationSeconds: 60 });
    await uploader.drain();
    expect(snapshots.length).toBeGreaterThanOrEqual(3); // enqueue, inflight start, inflight end
    const lastSnapshot = snapshots[snapshots.length - 1];
    expect(lastSnapshot.uploaded).toBe(1);
    expect(lastSnapshot.pending).toBe(0);
  });
});
