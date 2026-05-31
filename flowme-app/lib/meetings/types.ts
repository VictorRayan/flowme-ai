// Shared types for the meeting recording / diarization pipeline.
// See docs/13-meeting-recording-diarization-plan.md.

export type MeetingStatus =
  | 'recording'
  | 'uploading'
  | 'audio_persisted'
  | 'processing'
  | 'finalization_review'
  | 'reanalyzing'
  | 'ready'
  | 'failed'
  | 'awaiting_retry';

export type MeetingFailedStage = 'assemble' | 'transcribe' | 'diarize' | 'summarize' | 'save';

export type MeetingIdentityStatus = 'unknown' | 'suggested' | 'confirmed' | 'generic';

export type MeetingTaskStatus = 'suggested' | 'accepted' | 'dismissed';

export type MeetingCorrectionStatus = 'pending' | 'applied' | 'rejected' | 'failed';

export type MeetingChunkStatus = 'pending' | 'uploaded' | 'failed';

export interface DiarizedSegment {
  providerLabel: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface TranscriptionResult {
  segments: DiarizedSegment[];
  detectedLanguage: string;
  providerName: 'gemini' | 'openai';
  providerReceiptId: string | null;
}

export interface KnownSpeakerReference {
  personId: string;
  displayName: string;
  referenceAudioR2Key: string;
}

export interface TranscriptionInput {
  audioR2Key: string;
  audioMimeType: string;
  language: 'pt' | 'en' | 'auto';
  expectedSpeakerCount?: number;
  participantsHint?: string[];
  // Phase 3.2 — passed when the user has opted into voice profiles AND known
  // speaker references exist for participants in this meeting. Current Gemini
  // and OpenAI APIs do not consume this (they do not support speaker
  // identification by reference), so adapters MUST ignore unknown fields.
  knownSpeakers?: KnownSpeakerReference[];
}

export interface MeetingSpeakerSummary {
  speakerId: string;
  providerLabel: string;
  displayLabel: string;
  resumoDeFalas: string;
  excerpts: string[];
  turnCount: number;
  totalSpokenSeconds: number;
}

export interface MeetingTaskSuggestion {
  description: string;
  assigneeProviderLabel: string | null;
  dueIso: string | null;
}

export interface PipelineAttemptLog {
  stage: 'assemble' | 'transcribe_diarize' | 'summarize' | 'save' | 'reanalyze';
  startedAt: string;
  endedAt: string;
  ok: boolean;
  errorCode?: string;
  provider?: 'gemini' | 'openai';
}

export interface ReassignmentInstruction {
  merges: Array<{ from: string[]; into: string }>;
  reassignments: Array<{ segmentSequenceNumbers: number[]; toProviderLabel: string }>;
}
