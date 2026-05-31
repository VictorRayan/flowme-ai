// Pipeline orchestrator. Composes Stage 1 (assemble), Stage 2 (transcribe +
// diarize) and Stage 3 (summarize), and Stage 8.3 (reanalyze) into a single
// retryable function with stage-isolated failure handling.

import {
  appendAttempt,
  getMeeting,
  listUploadedChunks,
  replaceTasks,
  replaceTranscript,
  updateMeetingStatus,
  type MeetingRow,
} from './store';
import { assembleMeetingAudio } from './assemble';
import { routedDiarizationAdapter } from './diarization-adapter';
import { summarizeTranscript } from './summarize';
import { applyReassignment, reassignSpeakers } from './reassign';
import type {
  DiarizedSegment,
  MeetingFailedStage,
  ReassignmentInstruction,
} from './types';
import { notifyMeetingProcessed } from './notifications';
import type { KnownSpeakerReference } from './types';

export type PipelineStartFrom = 'assemble' | 'transcribe' | 'summarize';

export interface PipelineRunOptions {
  supabase: any;
  meetingId: string;
  startFrom?: PipelineStartFrom;
  diarizationAdapter?: ReturnType<typeof routedDiarizationAdapter>;
  summarizeFn?: typeof summarizeTranscript;
  assembleFn?: typeof assembleMeetingAudio;
  now?: () => Date;
}

export interface PipelineRunResult {
  ok: boolean;
  failedStage: MeetingFailedStage | null;
  error?: string;
}

export async function runMeetingPipeline(opts: PipelineRunOptions): Promise<PipelineRunResult> {
  const now = opts.now || (() => new Date());
  const supabase = opts.supabase;
  const startFrom: PipelineStartFrom = opts.startFrom || 'assemble';

  const meeting = await getMeeting(supabase, opts.meetingId);
  if (!meeting) return { ok: false, failedStage: null, error: 'meeting_not_found' };

  // Stage 1 — Assemble (skipped if final_audio_r2_key already set OR startFrom skips it)
  let finalAudioKey = meeting.final_audio_r2_key;
  let finalAudioMime = meeting.final_audio_mime_type;
  if (startFrom === 'assemble' && !finalAudioKey) {
    const start = now();
    await updateMeetingStatus(supabase, meeting.id, { status: 'processing', failed_stage: null });
    try {
      const chunks = await listUploadedChunks(supabase, meeting.id);
      if (chunks.length === 0) throw new Error('No uploaded chunks for this meeting');
      const assembleFn = opts.assembleFn || assembleMeetingAudio;
      const out = await assembleFn({
        meetingId: meeting.id,
        chunks: chunks.map((c) => ({ sequenceNumber: c.sequence_number, r2Key: c.r2_key, mimeType: c.mime_type })),
      });
      finalAudioKey = out.finalAudioR2Key;
      finalAudioMime = out.finalAudioMimeType;
      await updateMeetingStatus(supabase, meeting.id, {
        final_audio_r2_key: finalAudioKey,
        final_audio_mime_type: finalAudioMime,
        status: 'audio_persisted',
      });
      await appendAttempt(supabase, meeting, { stage: 'assemble', startedAt: start.toISOString(), endedAt: now().toISOString(), ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'assemble_failed';
      await updateMeetingStatus(supabase, meeting.id, { status: 'failed', failed_stage: 'assemble', failure_reason: message });
      await appendAttempt(supabase, meeting, { stage: 'assemble', startedAt: start.toISOString(), endedAt: now().toISOString(), ok: false, errorCode: message });
      void notifyMeetingProcessed({ supabase, userId: meeting.user_id, meetingId: meeting.id, title: meeting.title, kind: 'failed', failedStage: 'assemble' });
      return { ok: false, failedStage: 'assemble', error: message };
    }
  } else if (!finalAudioKey) {
    return { ok: false, failedStage: 'assemble', error: 'cannot skip Stage 1: no final_audio_r2_key' };
  }

  // Stage 2 — Transcribe + Diarize
  let segments: DiarizedSegment[] = [];
  let providerName: 'gemini' | 'openai' = 'gemini';
  let fallbackReason: string | null = null;
  if (startFrom === 'assemble' || startFrom === 'transcribe') {
    const start = now();
    await updateMeetingStatus(supabase, meeting.id, { status: 'processing', failed_stage: null });
    try {
      const adapter = opts.diarizationAdapter || routedDiarizationAdapter();
      const meetingSummary = (meeting.summary || {}) as { participantsHint?: string[] };
      const participantsHint = Array.isArray(meetingSummary.participantsHint)
        ? meetingSummary.participantsHint
        : undefined;
      const knownSpeakers = await loadKnownSpeakerReferences(supabase, meeting.user_id, participantsHint);
      const result = await adapter.transcribeWithDiarization({
        audioR2Key: finalAudioKey,
        audioMimeType: finalAudioMime || 'audio/mpeg',
        language: 'auto',
        participantsHint,
        knownSpeakers: knownSpeakers.length > 0 ? knownSpeakers : undefined,
      });
      segments = result.segments;
      providerName = result.providerName;
      fallbackReason = result.fallbackReason;
      const { speakers } = await replaceTranscript(supabase, meeting.id, segments);
      void speakers;
      await updateMeetingStatus(supabase, meeting.id, {
        provider: providerName,
        fallback_reason: fallbackReason,
        language: result.detectedLanguage,
      });
      await appendAttempt(supabase, meeting, { stage: 'transcribe_diarize', startedAt: start.toISOString(), endedAt: now().toISOString(), ok: true, provider: providerName });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'transcribe_failed';
      await updateMeetingStatus(supabase, meeting.id, { status: 'failed', failed_stage: 'transcribe', failure_reason: message });
      await appendAttempt(supabase, meeting, { stage: 'transcribe_diarize', startedAt: start.toISOString(), endedAt: now().toISOString(), ok: false, errorCode: message });
      void notifyMeetingProcessed({ supabase, userId: meeting.user_id, meetingId: meeting.id, title: meeting.title, kind: 'failed', failedStage: 'transcribe' });
      return { ok: false, failedStage: 'transcribe', error: message };
    }
  } else {
    // startFrom === 'summarize': load segments from DB
    const { data } = await supabase
      .from('meeting_transcript_segments')
      .select('sequence_number, start_seconds, end_seconds, text, meeting_speakers(provider_label)')
      .eq('meeting_recording_id', meeting.id)
      .order('sequence_number', { ascending: true });
    segments = ((data || []) as any[]).map((r) => ({
      providerLabel: r.meeting_speakers?.provider_label || 'A',
      startSeconds: Number(r.start_seconds),
      endSeconds: Number(r.end_seconds),
      text: String(r.text),
    }));
  }

  // Stage 3 — Summarize
  const start = now();
  try {
    const summarize = opts.summarizeFn || summarizeTranscript;
    const meetingSummary = (meeting.summary || {}) as { participantsHint?: string[] };
    const summary = await summarize({
      transcript: segments,
      meetingTitle: meeting.title,
      participantsHint: Array.isArray(meetingSummary.participantsHint) ? meetingSummary.participantsHint : undefined,
    });
    await updateMeetingStatus(supabase, meeting.id, {
      subject: summary.subject || meeting.subject,
      objective: summary.objective || meeting.objective,
      summary: { speakerSummaries: summary.speakerSummaries, participantsHint: meetingSummary.participantsHint || [] } as any,
    });
    await replaceTasks(supabase, meeting.id, summary.tasks, new Map());
    await appendAttempt(supabase, meeting, { stage: 'summarize', startedAt: start.toISOString(), endedAt: now().toISOString(), ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'summarize_failed';
    await updateMeetingStatus(supabase, meeting.id, { status: 'failed', failed_stage: 'summarize', failure_reason: message });
    await appendAttempt(supabase, meeting, { stage: 'summarize', startedAt: start.toISOString(), endedAt: now().toISOString(), ok: false, errorCode: message });
    void notifyMeetingProcessed({ supabase, userId: meeting.user_id, meetingId: meeting.id, title: meeting.title, kind: 'failed', failedStage: 'summarize' });
    return { ok: false, failedStage: 'summarize', error: message };
  }

  await updateMeetingStatus(supabase, meeting.id, { status: 'finalization_review', failed_stage: null, failure_reason: null });
  void notifyMeetingProcessed({ supabase, userId: meeting.user_id, meetingId: meeting.id, title: meeting.title, kind: 'ready' });
  return { ok: true, failedStage: null };
}

// ── Reanalysis driven by an audio correction (§8.3) ────────────────────────

export interface ReanalysisOptions {
  supabase: any;
  meetingId: string;
  correctionText: string;
  correctionId: string;
  reassignFn?: typeof reassignSpeakers;
  now?: () => Date;
}

export async function runReanalysis(opts: ReanalysisOptions): Promise<{ ok: boolean; instruction?: ReassignmentInstruction; error?: string }> {
  const now = opts.now || (() => new Date());
  const supabase = opts.supabase;
  const meeting = await getMeeting(supabase, opts.meetingId);
  if (!meeting) return { ok: false, error: 'meeting_not_found' };

  await updateMeetingStatus(supabase, meeting.id, { status: 'reanalyzing' });

  const { data: rows } = await supabase
    .from('meeting_transcript_segments')
    .select('sequence_number, text, meeting_speaker_id, meeting_speakers(provider_label)')
    .eq('meeting_recording_id', meeting.id)
    .order('sequence_number', { ascending: true });

  const segmentsForLLM = ((rows || []) as any[]).map((r) => ({
    sequenceNumber: r.sequence_number,
    providerLabel: r.meeting_speakers?.provider_label || 'A',
    text: r.text,
  }));
  const labels = Array.from(new Set(segmentsForLLM.map((s) => s.providerLabel)));

  const reassignFn = opts.reassignFn || reassignSpeakers;
  let instruction: ReassignmentInstruction;
  try {
    instruction = await reassignFn({
      segments: segmentsForLLM,
      currentSpeakerLabels: labels,
      correctionText: opts.correctionText,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'reanalyze_failed';
    await supabase.from('meeting_speaker_corrections')
      .update({ status: 'failed', failure_reason: message })
      .eq('id', opts.correctionId);
    await updateMeetingStatus(supabase, meeting.id, { status: 'finalization_review' });
    return { ok: false, error: message };
  }

  const updated = applyReassignment(segmentsForLLM, instruction);

  // Build a map providerLabel → meeting_speaker_id (existing speakers)
  const { data: speakers } = await supabase
    .from('meeting_speakers')
    .select('id, provider_label')
    .eq('meeting_recording_id', meeting.id);
  const speakerIdByLabel = new Map<string, string>();
  for (const s of ((speakers || []) as any[])) speakerIdByLabel.set(s.provider_label, s.id);

  // Apply: update each segment to its new speaker (resolving merges).
  for (const seg of updated) {
    const speakerId = speakerIdByLabel.get(seg.providerLabel);
    if (!speakerId) continue;
    await supabase
      .from('meeting_transcript_segments')
      .update({ meeting_speaker_id: speakerId })
      .eq('meeting_recording_id', meeting.id)
      .eq('sequence_number', seg.sequenceNumber);
  }

  // Deactivate speakers whose entire population was merged away.
  const survivingLabels = new Set(updated.map((s) => s.providerLabel));
  for (const label of labels) {
    if (!survivingLabels.has(label)) {
      await supabase.from('meeting_speakers')
        .update({ is_active: false })
        .eq('meeting_recording_id', meeting.id)
        .eq('provider_label', label);
    }
  }

  const segmentChangeCounts: Record<string, number> = {};
  for (const seg of updated) {
    const original = segmentsForLLM.find((s) => s.sequenceNumber === seg.sequenceNumber);
    if (!original || original.providerLabel === seg.providerLabel) continue;
    const key = `${original.providerLabel}->${seg.providerLabel}`;
    segmentChangeCounts[key] = (segmentChangeCounts[key] || 0) + 1;
  }

  await supabase.from('meeting_speaker_corrections')
    .update({
      status: 'applied',
      applied_at: now().toISOString(),
      prior_speaker_map: { labels },
      applied_speaker_map: { instruction },
      applied_segment_changes: segmentChangeCounts,
    })
    .eq('id', opts.correctionId);

  await updateMeetingStatus(supabase, meeting.id, { status: 'finalization_review' });
  void notifyMeetingProcessed({ supabase, userId: meeting.user_id, meetingId: meeting.id, title: meeting.title, kind: 'reanalyzed' });
  return { ok: true, instruction };
}

// Load known-speaker references for participants hinted in the meeting.
// Returns [] when the user has not opted into voice profiles. Current
// transcription providers don't consume this yet — adapters store it for
// when Gemini/OpenAI expose a speaker-identification feature.
async function loadKnownSpeakerReferences(
  supabase: any,
  userId: string,
  participantsHint: string[] | undefined,
): Promise<KnownSpeakerReference[]> {
  if (!participantsHint || participantsHint.length === 0) return [];

  const { data: settings } = await supabase
    .from('user_profile')
    .select('voice_profiles_enabled')
    .eq('user_id', userId)
    .maybeSingle();
  if (!settings?.voice_profiles_enabled) return [];

  const { data: people } = await supabase
    .from('people')
    .select('id, full_name')
    .eq('user_id', userId)
    .in('full_name', participantsHint);
  const peopleList = (people || []) as Array<{ id: string; full_name: string }>;
  if (peopleList.length === 0) return [];

  const { data: profiles } = await supabase
    .from('voice_profiles')
    .select('person_id, reference_audio_r2_key')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('person_id', peopleList.map((p) => p.id));
  const profileByPerson = new Map<string, string>();
  for (const p of (profiles || []) as Array<{ person_id: string; reference_audio_r2_key: string }>) {
    profileByPerson.set(p.person_id, p.reference_audio_r2_key);
  }
  return peopleList
    .filter((p) => profileByPerson.has(p.id))
    .map((p) => ({ personId: p.id, displayName: p.full_name, referenceAudioR2Key: profileByPerson.get(p.id)! }));
}
