'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChunkUploader, httpUploadAdapter, type QueueSnapshot } from '@/lib/recording/chunk-uploader';
import { pickSupportedAudioMimeType } from '@/lib/recording/pick-mime-type';

const CHUNK_INTERVAL_MS = 120_000; // 2 minutes per chunk

type RecordingStatus = 'idle' | 'starting' | 'recording' | 'paused' | 'stopping' | 'finalizing';

interface StartMeetingOptions {
  title: string;
  subject?: string;
  objective?: string;
  captureSystemAudio: boolean;
  participantsHint?: string[];
}

interface RecordingContextValue {
  status: RecordingStatus;
  meetingId: string | null;
  meetingTitle: string;
  elapsedMs: number;
  uploadSnapshot: QueueSnapshot;
  capturedSources: ('microphone' | 'system_audio')[];
  error: string | null;
  start(opts: StartMeetingOptions): Promise<void>;
  stop(): Promise<{ meetingId: string } | null>;
  cancel(): Promise<void>;
}

const noop = async () => {};
const RecordingContext = React.createContext<RecordingContextValue>({
  status: 'idle',
  meetingId: null,
  meetingTitle: '',
  elapsedMs: 0,
  uploadSnapshot: { pending: 0, inflight: 0, uploaded: 0, failed: 0 },
  capturedSources: [],
  error: null,
  start: noop as any,
  stop: noop as any,
  cancel: noop as any,
});

export function useRecording(): RecordingContextValue {
  return React.useContext(RecordingContext);
}

export default function RecordingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<RecordingStatus>('idle');
  const [meetingId, setMeetingId] = React.useState<string | null>(null);
  const [meetingTitle, setMeetingTitle] = React.useState('');
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [uploadSnapshot, setUploadSnapshot] = React.useState<QueueSnapshot>({ pending: 0, inflight: 0, uploaded: 0, failed: 0 });
  const [capturedSources, setCapturedSources] = React.useState<('microphone' | 'system_audio')[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const micStreamRef = React.useRef<MediaStream | null>(null);
  const displayStreamRef = React.useRef<MediaStream | null>(null);
  const mixedStreamRef = React.useRef<MediaStream | null>(null);
  const uploaderRef = React.useRef<ChunkUploader | null>(null);
  const sequenceRef = React.useRef(0);
  const startedAtRef = React.useRef<number | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkStartRef = React.useRef<number>(0);

  const cleanupTracks = React.useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    for (const s of [micStreamRef.current, displayStreamRef.current, mixedStreamRef.current]) {
      if (!s) continue;
      try { s.getTracks().forEach((t) => t.stop()); } catch {}
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
    }
    micStreamRef.current = null;
    displayStreamRef.current = null;
    mixedStreamRef.current = null;
    audioContextRef.current = null;
    recorderRef.current = null;
  }, []);

  const start = React.useCallback(async (opts: StartMeetingOptions) => {
    if (status !== 'idle') return;
    setError(null);
    setStatus('starting');

    // 1) Create the meeting row.
    let createdId: string | null = null;
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: opts.title,
          subject: opts.subject || null,
          objective: opts.objective || null,
          consent: true,
          capturedSources: opts.captureSystemAudio ? ['microphone', 'system_audio'] : ['microphone'],
          participantsHint: Array.isArray(opts.participantsHint) ? opts.participantsHint.filter(Boolean) : [],
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.meeting?.id) throw new Error(body?.error?.message || 'failed to create meeting');
      createdId = body.meeting.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'create_meeting_failed');
      setStatus('idle');
      return;
    }

    // 2) Capture microphone (required) and optionally system audio.
    let micStream: MediaStream;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'mic_permission_denied');
      setStatus('idle');
      return;
    }

    const sources: ('microphone' | 'system_audio')[] = ['microphone'];
    let mixedStream: MediaStream = micStream;
    let displayStream: MediaStream | null = null;
    if (opts.captureSystemAudio) {
      try {
        displayStream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
        // We only want the audio track from screen-share.
        for (const v of displayStream.getVideoTracks()) v.stop();
        const audioTracks = displayStream.getAudioTracks();
        if (audioTracks.length > 0) {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = ctx;
          const dest = ctx.createMediaStreamDestination();
          const micSource = ctx.createMediaStreamSource(micStream);
          micSource.connect(ctx.createGain()).connect(dest);
          const sysSource = ctx.createMediaStreamSource(new MediaStream(audioTracks));
          sysSource.connect(ctx.createGain()).connect(dest);
          mixedStream = dest.stream;
          sources.push('system_audio');
        }
      } catch (e) {
        console.warn('[recording] system audio capture failed, continuing with mic only', e);
      }
    }

    micStreamRef.current = micStream;
    displayStreamRef.current = displayStream;
    mixedStreamRef.current = mixedStream;
    setCapturedSources(sources);

    // 3) Start the MediaRecorder.
    const mimeType = pickSupportedAudioMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(mixedStream, { mimeType });
    } catch (e) {
      console.warn('[recording] preferred mime failed, falling back', e);
      recorder = new MediaRecorder(mixedStream);
    }
    recorderRef.current = recorder;
    sequenceRef.current = 0;
    chunkStartRef.current = Date.now();

    const uploader = new ChunkUploader({
      meetingId: createdId!,
      adapter: httpUploadAdapter(),
      onQueueChange: setUploadSnapshot,
    });
    uploaderRef.current = uploader;

    recorder.ondataavailable = (evt) => {
      if (!evt.data || evt.data.size === 0) return;
      const seq = (sequenceRef.current += 1);
      const now = Date.now();
      const duration = Math.max(0, Math.floor((now - chunkStartRef.current) / 1000));
      chunkStartRef.current = now;
      uploader.enqueue({ sequenceNumber: seq, blob: evt.data, mimeType, durationSeconds: duration });
    };

    recorder.start(CHUNK_INTERVAL_MS);

    setMeetingId(createdId);
    setMeetingTitle(opts.title);
    setStatus('recording');
    startedAtRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (startedAtRef.current) setElapsedMs(Date.now() - startedAtRef.current);
    }, 500);

    if (typeof window !== 'undefined') {
      const handler = (e: BeforeUnloadEvent) => {
        if (status !== 'idle') { e.preventDefault(); e.returnValue = ''; }
      };
      window.addEventListener('beforeunload', handler);
      // best effort cleanup; provider unmount also fires cleanup
    }
  }, [status]);

  const stop = React.useCallback(async (): Promise<{ meetingId: string } | null> => {
    const recorder = recorderRef.current;
    const uploader = uploaderRef.current;
    const id = meetingId;
    if (!recorder || !id) return null;
    setStatus('stopping');

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      try { recorder.stop(); } catch { resolve(); }
    });

    if (uploader) {
      try { await uploader.drain(60_000); } catch {}
    }
    cleanupTracks();

    setStatus('finalizing');
    try {
      const durationSeconds = startedAtRef.current ? Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)) : 0;
      await fetch(`/api/meetings/${id}/finalize`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ duration_seconds: durationSeconds }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'finalize_failed');
    }

    setStatus('idle');
    setMeetingId(null);
    setMeetingTitle('');
    setElapsedMs(0);
    setCapturedSources([]);
    startedAtRef.current = null;
    router.push(`/app/notes/meetings/${id}/finalize`);
    return { meetingId: id };
  }, [meetingId, cleanupTracks, router]);

  const cancel = React.useCallback(async () => {
    cleanupTracks();
    setStatus('idle');
    setMeetingId(null);
    setMeetingTitle('');
    setElapsedMs(0);
    setError(null);
    setCapturedSources([]);
    startedAtRef.current = null;
  }, [cleanupTracks]);

  // Cleanup on unmount.
  React.useEffect(() => () => cleanupTracks(), [cleanupTracks]);

  const value: RecordingContextValue = {
    status,
    meetingId,
    meetingTitle,
    elapsedMs,
    uploadSnapshot,
    capturedSources,
    error,
    start,
    stop,
    cancel,
  };

  return <RecordingContext.Provider value={value}>{children}</RecordingContext.Provider>;
}
