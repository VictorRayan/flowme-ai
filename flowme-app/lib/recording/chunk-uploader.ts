// Pure logic for uploading meeting chunks. Decoupled from MediaRecorder so it
// can be unit-tested without a real browser.

export interface ChunkPayload {
  sequenceNumber: number;
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
}

export interface UploadAdapter {
  uploadChunk(meetingId: string, payload: ChunkPayload): Promise<{ ok: boolean; error?: string }>;
}

export interface ChunkUploaderOptions {
  meetingId: string;
  adapter: UploadAdapter;
  maxQueued?: number; // soft cap; warn when exceeded
  onQueueChange?: (state: QueueSnapshot) => void;
  onUploadEnd?: (sequenceNumber: number, ok: boolean) => void;
}

export interface QueueSnapshot {
  pending: number;
  inflight: number;
  uploaded: number;
  failed: number;
}

export class ChunkUploader {
  private readonly opts: ChunkUploaderOptions;
  private queue: ChunkPayload[] = [];
  private inflight = 0;
  private uploaded = 0;
  private failed = 0;
  private running = false;

  constructor(opts: ChunkUploaderOptions) {
    this.opts = opts;
  }

  enqueue(payload: ChunkPayload): void {
    this.queue.push(payload);
    this.notify();
    this.tick();
  }

  snapshot(): QueueSnapshot {
    return {
      pending: this.queue.length,
      inflight: this.inflight,
      uploaded: this.uploaded,
      failed: this.failed,
    };
  }

  isIdle(): boolean {
    return this.queue.length === 0 && this.inflight === 0;
  }

  async drain(timeoutMs = 60_000): Promise<void> {
    const start = Date.now();
    while (!this.isIdle()) {
      if (Date.now() - start > timeoutMs) throw new Error('drain timeout');
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  private notify() {
    if (this.opts.onQueueChange) this.opts.onQueueChange(this.snapshot());
  }

  private tick() {
    if (this.running) return;
    if (this.queue.length === 0) return;
    this.running = true;
    const next = this.queue.shift()!;
    this.inflight += 1;
    this.notify();
    this.opts.adapter.uploadChunk(this.opts.meetingId, next)
      .then((res) => {
        this.inflight -= 1;
        if (res.ok) this.uploaded += 1;
        else { this.failed += 1; this.queue.unshift(next); }
        if (this.opts.onUploadEnd) this.opts.onUploadEnd(next.sequenceNumber, res.ok);
        this.notify();
      })
      .catch(() => {
        this.inflight -= 1;
        this.failed += 1;
        this.queue.unshift(next);
        if (this.opts.onUploadEnd) this.opts.onUploadEnd(next.sequenceNumber, false);
        this.notify();
      })
      .finally(() => {
        this.running = false;
        if (this.queue.length > 0) {
          // Don't burst — yield to event loop so the recorder can keep going.
          setTimeout(() => this.tick(), 0);
        }
      });
  }
}

// Default network adapter used in the browser.
export function httpUploadAdapter(): UploadAdapter {
  return {
    async uploadChunk(meetingId, payload) {
      const form = new FormData();
      form.append('file', payload.blob, `chunk-${payload.sequenceNumber}`);
      form.append('sequence_number', String(payload.sequenceNumber));
      form.append('mime_type', payload.mimeType);
      form.append('duration_seconds', String(payload.durationSeconds));
      try {
        const res = await fetch(`/api/meetings/${meetingId}/chunks`, { method: 'POST', body: form });
        if (!res.ok) return { ok: false, error: `http_${res.status}` };
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'network_error' };
      }
    },
  };
}
