// Thin Supabase access layer for meeting recordings. Keeps SQL out of the
// pipeline + API routes so they can be unit-tested with simple mocks.

import type {
  DiarizedSegment,
  MeetingFailedStage,
  MeetingSpeakerSummary,
  MeetingStatus,
  MeetingTaskSuggestion,
  PipelineAttemptLog,
} from './types';

export interface MeetingRow {
  id: string;
  user_id: string;
  note_id: string | null;
  title: string;
  subject: string | null;
  objective: string | null;
  status: MeetingStatus;
  failed_stage: MeetingFailedStage | null;
  duration_seconds: number;
  language: string | null;
  provider: string | null;
  fallback_reason: string | null;
  final_audio_r2_key: string | null;
  final_audio_mime_type: string | null;
  summary: Record<string, unknown>;
  failure_reason: string | null;
  attempts: PipelineAttemptLog[];
  captured_sources: string[];
}

type SupabaseLike = { from(table: string): any };

export async function getMeeting(supabase: SupabaseLike, id: string): Promise<MeetingRow | null> {
  const { data } = await supabase
    .from('meeting_recordings')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return data as MeetingRow | null;
}

export async function updateMeetingStatus(
  supabase: SupabaseLike,
  id: string,
  patch: Partial<MeetingRow>,
): Promise<void> {
  await supabase
    .from('meeting_recordings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
}

export async function appendAttempt(
  supabase: SupabaseLike,
  meeting: MeetingRow,
  attempt: PipelineAttemptLog,
): Promise<void> {
  const next = [...(meeting.attempts || []), attempt].slice(-20);
  await updateMeetingStatus(supabase, meeting.id, { attempts: next });
}

export interface ListedChunk {
  id: string;
  sequence_number: number;
  r2_key: string;
  mime_type: string;
}

export async function listUploadedChunks(supabase: SupabaseLike, meetingId: string): Promise<ListedChunk[]> {
  const { data } = await supabase
    .from('meeting_recording_chunks')
    .select('id, sequence_number, r2_key, mime_type')
    .eq('meeting_recording_id', meetingId)
    .eq('upload_status', 'uploaded')
    .order('sequence_number', { ascending: true });
  return (data || []) as ListedChunk[];
}

export async function replaceTranscript(
  supabase: SupabaseLike,
  meetingId: string,
  segments: DiarizedSegment[],
): Promise<{ speakers: Array<{ id: string; provider_label: string }>; segmentIdsBySeq: Map<number, string> }> {
  // Drop prior segments + speakers for idempotency.
  await supabase.from('meeting_transcript_segments').delete().eq('meeting_recording_id', meetingId);
  await supabase.from('meeting_speakers').delete().eq('meeting_recording_id', meetingId);

  const labels = Array.from(new Set(segments.map((s) => s.providerLabel)));
  const speakerInserts = labels.map((label) => ({
    meeting_recording_id: meetingId,
    provider_label: label,
    display_label: `Falante ${label}`,
    identity_status: 'unknown' as const,
  }));
  const { data: speakers } = await supabase
    .from('meeting_speakers')
    .insert(speakerInserts)
    .select('id, provider_label');
  const speakerByLabel = new Map<string, string>();
  for (const s of (speakers || []) as Array<{ id: string; provider_label: string }>) {
    speakerByLabel.set(s.provider_label, s.id);
  }

  const segmentInserts = segments.map((s, idx) => ({
    meeting_recording_id: meetingId,
    meeting_speaker_id: speakerByLabel.get(s.providerLabel),
    sequence_number: idx + 1,
    start_seconds: s.startSeconds,
    end_seconds: s.endSeconds,
    text: s.text,
  }));
  const { data: insertedSegments } = await supabase
    .from('meeting_transcript_segments')
    .insert(segmentInserts)
    .select('id, sequence_number');

  const segmentIdsBySeq = new Map<number, string>();
  for (const seg of (insertedSegments || []) as Array<{ id: string; sequence_number: number }>) {
    segmentIdsBySeq.set(seg.sequence_number, seg.id);
  }

  return {
    speakers: (speakers || []) as Array<{ id: string; provider_label: string }>,
    segmentIdsBySeq,
  };
}

export async function writeSummary(
  supabase: SupabaseLike,
  meetingId: string,
  summary: { subject: string; objective: string; speakerSummaries: MeetingSpeakerSummary[] },
): Promise<void> {
  // Patch subject/objective on the meeting row and bag the speaker summaries
  // into the JSONB summary blob for the finalization UI.
  await updateMeetingStatus(supabase, meetingId, {
    subject: summary.subject,
    objective: summary.objective,
    summary: { speakerSummaries: summary.speakerSummaries },
  });
}

export async function replaceTasks(
  supabase: SupabaseLike,
  meetingId: string,
  tasks: MeetingTaskSuggestion[],
  speakerIdByLabel: Map<string, string>,
): Promise<void> {
  await supabase.from('meeting_tasks').delete().eq('meeting_recording_id', meetingId);
  if (tasks.length === 0) return;
  await supabase.from('meeting_tasks').insert(tasks.map((t) => ({
    meeting_recording_id: meetingId,
    description: t.description,
    due_at: t.dueIso,
    status: 'suggested',
  })));
  // assigneeProviderLabel resolution intentionally deferred until the user
  // confirms the speaker mapping on the finalization screen.
  void speakerIdByLabel;
}
