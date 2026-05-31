// Stage 1 helper: join meeting chunks into a single normalized audio file
// with ffmpeg, then upload to the durable final-audio R2 key.
//
// ffmpeg MUST be installed in the production runner image (see Dockerfile).
// In tests, the runner is mocked via mergeChunksToAudio dependency injection.

import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  downloadFromR2,
  uploadToR2,
} from '@/lib/r2/storage';
import {
  meetingChunkKey,
  meetingFinalAudioKey,
  extForMimeType,
} from './r2-keys';

export interface ChunkDescriptor {
  sequenceNumber: number;
  r2Key: string;
  mimeType: string;
}

export interface AssembleOptions {
  meetingId: string;
  chunks: ChunkDescriptor[];
  ffmpegPath?: string;
  runFfmpeg?: typeof runFfmpegDefault; // injectable for tests
  download?: typeof downloadFromR2; // injectable for tests
  upload?: typeof uploadToR2; // injectable for tests
}

export interface AssembleResult {
  finalAudioR2Key: string;
  finalAudioMimeType: string;
  outputBytes: number;
}

export async function assembleMeetingAudio(opts: AssembleOptions): Promise<AssembleResult> {
  if (!opts.chunks || opts.chunks.length === 0) {
    throw new Error('No chunks to assemble');
  }

  const ordered = [...opts.chunks].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const inputMime = ordered[0].mimeType;
  const inputExt = extForMimeType(inputMime);
  const outputExt = 'mp3';
  const outputMime = 'audio/mpeg';

  const download = opts.download || downloadFromR2;
  const upload = opts.upload || uploadToR2;
  const runFfmpeg = opts.runFfmpeg || runFfmpegDefault;

  const workdir = await mkdtemp(join(tmpdir(), `flowme-meeting-${opts.meetingId}-`));
  try {
    const chunkPaths: string[] = [];
    for (const chunk of ordered) {
      const buf = await downloadChunkToBuffer(chunk.r2Key, download);
      const localPath = join(workdir, `chunk-${chunk.sequenceNumber}.${inputExt}`);
      await writeFile(localPath, buf);
      chunkPaths.push(localPath);
    }

    const listPath = join(workdir, 'list.txt');
    await writeFile(listPath, chunkPaths.map((p) => `file '${p.replace(/'/g, "\\'")}'`).join('\n'));

    const outputPath = join(workdir, `audio.${outputExt}`);
    await runFfmpeg({
      args: [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', listPath,
        '-vn',
        '-ar', '16000',
        '-ac', '1',
        '-codec:a', 'libmp3lame',
        '-q:a', '4',
        outputPath,
      ],
      ffmpegPath: opts.ffmpegPath || 'ffmpeg',
    });

    const finalBuffer = await readFile(outputPath);
    const finalKey = meetingFinalAudioKey(opts.meetingId, outputExt);
    await upload({ key: finalKey, body: finalBuffer, contentType: outputMime });

    return {
      finalAudioR2Key: finalKey,
      finalAudioMimeType: outputMime,
      outputBytes: finalBuffer.byteLength,
    };
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

async function downloadChunkToBuffer(key: string, download: typeof downloadFromR2): Promise<Buffer> {
  const res = await download(key);
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) parts.push(value);
  }
  const totalLength = parts.reduce((acc, p) => acc + p.byteLength, 0);
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return Buffer.from(out);
}

export async function runFfmpegDefault(opts: { args: string[]; ffmpegPath: string }): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(opts.ffmpegPath, opts.args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(0, 500)}`));
    });
  });
}

// Local helper for routes that want to compose chunk keys consistently.
export function defaultChunkKey(meetingId: string, sequenceNumber: number, mimeType: string): string {
  return meetingChunkKey(meetingId, sequenceNumber, extForMimeType(mimeType));
}
