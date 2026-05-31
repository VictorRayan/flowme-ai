import { runMeetingPipeline, runReanalysis } from '@/lib/meetings/pipeline';

type Row = Record<string, any>;

function makeSupabase(initial: {
  meeting?: Row;
  chunks?: Row[];
  segments?: Row[];
  speakers?: Row[];
}) {
  const state = {
    meeting: initial.meeting ? { ...initial.meeting } : null,
    chunks: initial.chunks ? [...initial.chunks] : [],
    segments: initial.segments ? [...initial.segments] : [],
    speakers: initial.speakers ? [...initial.speakers] : [],
    tasks: [] as Row[],
    corrections: [] as Row[],
  };

  function maybeSingle(row: Row | null) {
    return Promise.resolve({ data: row, error: null });
  }

  function makeChain(table: string, dataFn: () => any[]) {
    const filters: Array<{ col: string; val: any }> = [];
    const inserts: any[] = [];
    const updates: Record<string, any> = {};
    let action: 'select' | 'insert' | 'update' | 'delete' | null = null;
    let selectShape: string = '';

    const chain: any = {
      select(shape?: string) { action = action || 'select'; selectShape = shape || '*'; return chain; },
      insert(payload: any) {
        action = 'insert';
        const rows = Array.isArray(payload) ? payload : [payload];
        for (const row of rows) {
          const withId = { id: 'id-' + Math.random().toString(36).slice(2, 9), ...row };
          inserts.push(withId);
          dataFn().push(withId);
        }
        return chain;
      },
      update(patch: any) { action = 'update'; Object.assign(updates, patch); return chain; },
      delete() { action = 'delete'; return chain; },
      eq(col: string, val: any) { filters.push({ col, val }); return chain; },
      order() { return chain; },
      maybeSingle() {
        const rows = filtered(dataFn(), filters);
        return maybeSingle(rows[0] || null);
      },
      then(resolve: any, reject: any) {
        const rows = filtered(dataFn(), filters);
        if (action === 'delete') {
          const ids = new Set(rows.map((r: any) => r.id));
          const arr = dataFn();
          for (let i = arr.length - 1; i >= 0; i--) if (ids.has(arr[i].id)) arr.splice(i, 1);
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        }
        if (action === 'update') {
          for (const r of rows) Object.assign(r, updates);
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        }
        if (action === 'insert') {
          return Promise.resolve({ data: inserts, error: null }).then(resolve, reject);
        }
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
      },
    };
    void selectShape;
    return chain;
  }

  function filtered(rows: any[], filters: Array<{ col: string; val: any }>): any[] {
    return rows.filter((row) => filters.every((f) => row[f.col] === f.val));
  }

  return {
    state,
    from(table: string) {
      switch (table) {
        case 'meeting_recordings': return makeChain(table, () => state.meeting ? [state.meeting] : []);
        case 'meeting_recording_chunks': return makeChain(table, () => state.chunks);
        case 'meeting_transcript_segments': return makeChain(table, () => state.segments);
        case 'meeting_speakers': return makeChain(table, () => state.speakers);
        case 'meeting_tasks': return makeChain(table, () => state.tasks);
        case 'meeting_speaker_corrections': return makeChain(table, () => state.corrections);
        default: throw new Error('unexpected table ' + table);
      }
    },
  };
}

const baseMeeting = {
  id: 'm1',
  user_id: 'u1',
  title: 'Reuniao teste',
  status: 'uploading',
  attempts: [],
  summary: {},
  final_audio_r2_key: null,
  final_audio_mime_type: null,
};

describe('runMeetingPipeline', () => {
  it('walks every stage successfully and lands at finalization_review', async () => {
    const sb: any = makeSupabase({
      meeting: { ...baseMeeting },
      chunks: [
        { meeting_recording_id: 'm1', sequence_number: 1, r2_key: 'k1', mime_type: 'audio/webm', upload_status: 'uploaded' },
      ],
    });
    const assembleFn = jest.fn().mockResolvedValue({ finalAudioR2Key: 'meetings/m1/audio.mp3', finalAudioMimeType: 'audio/mpeg', outputBytes: 1024 });
    const adapter = {
      transcribeWithDiarization: jest.fn().mockResolvedValue({
        segments: [
          { providerLabel: 'A', startSeconds: 0, endSeconds: 2, text: 'oi' },
          { providerLabel: 'B', startSeconds: 2, endSeconds: 4, text: 'oi' },
        ],
        detectedLanguage: 'pt',
        providerName: 'gemini' as const,
        providerReceiptId: null,
        fallbackReason: null,
      }),
    };
    const summarizeFn = jest.fn().mockResolvedValue({
      subject: 'Sub',
      objective: 'Obj',
      speakerSummaries: [
        { speakerId: '', providerLabel: 'A', displayLabel: 'Falante A', resumoDeFalas: 'r', excerpts: [], turnCount: 1, totalSpokenSeconds: 2 },
      ],
      tasks: [{ description: 'X', assigneeProviderLabel: 'A', dueIso: null }],
    });

    const result = await runMeetingPipeline({
      supabase: sb,
      meetingId: 'm1',
      assembleFn: assembleFn as any,
      diarizationAdapter: adapter as any,
      summarizeFn: summarizeFn as any,
    });

    expect(result.ok).toBe(true);
    expect(sb.state.meeting.status).toBe('finalization_review');
    expect(sb.state.meeting.final_audio_r2_key).toBe('meetings/m1/audio.mp3');
    expect(sb.state.speakers.map((s: any) => s.provider_label).sort()).toEqual(['A', 'B']);
    expect(sb.state.segments).toHaveLength(2);
    expect(sb.state.tasks).toHaveLength(1);
    expect(sb.state.meeting.attempts).toHaveLength(3);
    expect(sb.state.meeting.attempts.every((a: any) => a.ok)).toBe(true);
  });

  it('marks failed_stage=assemble and preserves the chunks when Stage 1 fails', async () => {
    const sb: any = makeSupabase({ meeting: { ...baseMeeting }, chunks: [{ meeting_recording_id: 'm1', sequence_number: 1, r2_key: 'k', mime_type: 'audio/webm', upload_status: 'uploaded' }] });
    const assembleFn = jest.fn().mockRejectedValue(new Error('ffmpeg blew up'));
    const result = await runMeetingPipeline({ supabase: sb, meetingId: 'm1', assembleFn: assembleFn as any });
    expect(result.ok).toBe(false);
    expect(result.failedStage).toBe('assemble');
    expect(sb.state.meeting.status).toBe('failed');
    expect(sb.state.meeting.failed_stage).toBe('assemble');
    expect(sb.state.meeting.final_audio_r2_key).toBeNull();
  });

  it('keeps the audio durable when Stage 2 fails (transcribe) — audio stays attached', async () => {
    const sb: any = makeSupabase({ meeting: { ...baseMeeting }, chunks: [{ meeting_recording_id: 'm1', sequence_number: 1, r2_key: 'k', mime_type: 'audio/webm', upload_status: 'uploaded' }] });
    const assembleFn = jest.fn().mockResolvedValue({ finalAudioR2Key: 'meetings/m1/audio.mp3', finalAudioMimeType: 'audio/mpeg', outputBytes: 1024 });
    const adapter = { transcribeWithDiarization: jest.fn().mockRejectedValue(new Error('both providers down')) };
    const result = await runMeetingPipeline({ supabase: sb, meetingId: 'm1', assembleFn: assembleFn as any, diarizationAdapter: adapter as any });
    expect(result.ok).toBe(false);
    expect(result.failedStage).toBe('transcribe');
    expect(sb.state.meeting.final_audio_r2_key).toBe('meetings/m1/audio.mp3'); // ← DURABLE
    expect(sb.state.meeting.status).toBe('failed');
  });

  it('Stage 1 is skipped when final_audio_r2_key is already set (retry path)', async () => {
    const sb: any = makeSupabase({
      meeting: { ...baseMeeting, final_audio_r2_key: 'meetings/m1/audio.mp3', final_audio_mime_type: 'audio/mpeg' },
    });
    const assembleFn = jest.fn();
    const adapter = {
      transcribeWithDiarization: jest.fn().mockResolvedValue({ segments: [{ providerLabel: 'A', startSeconds: 0, endSeconds: 2, text: 'oi' }], detectedLanguage: 'pt', providerName: 'gemini', providerReceiptId: null, fallbackReason: null }),
    };
    const summarizeFn = jest.fn().mockResolvedValue({ subject: '', objective: '', speakerSummaries: [], tasks: [] });
    const result = await runMeetingPipeline({ supabase: sb, meetingId: 'm1', assembleFn: assembleFn as any, diarizationAdapter: adapter as any, summarizeFn: summarizeFn as any });
    expect(result.ok).toBe(true);
    expect(assembleFn).not.toHaveBeenCalled();
  });
});

describe('runReanalysis', () => {
  it('applies a merge: B → A reassigns every B segment to A and deactivates B', async () => {
    const sb: any = makeSupabase({
      meeting: { ...baseMeeting, status: 'finalization_review', final_audio_r2_key: 'meetings/m1/audio.mp3' },
      speakers: [
        { id: 'sp-a', meeting_recording_id: 'm1', provider_label: 'A', is_active: true },
        { id: 'sp-b', meeting_recording_id: 'm1', provider_label: 'B', is_active: true },
      ],
      segments: [
        { id: 'seg-1', meeting_recording_id: 'm1', sequence_number: 1, meeting_speaker_id: 'sp-a', text: 'a1', meeting_speakers: { provider_label: 'A' } },
        { id: 'seg-2', meeting_recording_id: 'm1', sequence_number: 2, meeting_speaker_id: 'sp-b', text: 'b1', meeting_speakers: { provider_label: 'B' } },
      ],
    });
    sb.state.corrections.push({ id: 'corr-1', meeting_recording_id: 'm1', status: 'pending' });

    const reassignFn = jest.fn().mockResolvedValue({ merges: [{ from: ['B'], into: 'A' }], reassignments: [] });
    const out = await runReanalysis({ supabase: sb, meetingId: 'm1', correctionText: 'B e A sao a mesma pessoa', correctionId: 'corr-1', reassignFn: reassignFn as any });
    expect(out.ok).toBe(true);
    expect(sb.state.meeting.status).toBe('finalization_review');
    const speakerB = sb.state.speakers.find((s: any) => s.provider_label === 'B');
    expect(speakerB.is_active).toBe(false);
    const correction = sb.state.corrections[0];
    expect(correction.status).toBe('applied');
    expect(correction.applied_speaker_map).toBeDefined();
  });

  it('marks the correction failed when the model errors and keeps the meeting reviewable', async () => {
    const sb: any = makeSupabase({
      meeting: { ...baseMeeting, status: 'finalization_review' },
      speakers: [{ id: 'sp-a', meeting_recording_id: 'm1', provider_label: 'A', is_active: true }],
      segments: [{ id: 'seg-1', meeting_recording_id: 'm1', sequence_number: 1, meeting_speaker_id: 'sp-a', text: 'a1', meeting_speakers: { provider_label: 'A' } }],
    });
    sb.state.corrections.push({ id: 'corr-2', meeting_recording_id: 'm1', status: 'pending' });
    const reassignFn = jest.fn().mockRejectedValue(new Error('Reassignment response was not valid JSON'));
    const out = await runReanalysis({ supabase: sb, meetingId: 'm1', correctionText: 'foo', correctionId: 'corr-2', reassignFn: reassignFn as any });
    expect(out.ok).toBe(false);
    expect(sb.state.corrections[0].status).toBe('failed');
    expect(sb.state.meeting.status).toBe('finalization_review');
  });
});
