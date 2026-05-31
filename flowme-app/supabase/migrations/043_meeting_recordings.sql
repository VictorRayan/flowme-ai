-- 043_meeting_recordings.sql
-- Meeting recording, diarization and finalization tables.
-- See docs/13-meeting-recording-diarization-plan.md for the full design.
-- 040–042 are reserved by the active mentorship plan.

CREATE TYPE public.meeting_status AS ENUM (
  'recording',
  'uploading',
  'audio_persisted',
  'processing',
  'finalization_review',
  'reanalyzing',
  'ready',
  'failed',
  'awaiting_retry'
);

CREATE TYPE public.meeting_failed_stage AS ENUM (
  'assemble',
  'transcribe',
  'diarize',
  'summarize',
  'save'
);

CREATE TYPE public.meeting_identity_status AS ENUM (
  'unknown',
  'suggested',
  'confirmed',
  'generic'
);

CREATE TYPE public.meeting_task_status AS ENUM (
  'suggested',
  'accepted',
  'dismissed'
);

CREATE TYPE public.meeting_correction_status AS ENUM (
  'pending',
  'applied',
  'rejected',
  'failed'
);

CREATE TYPE public.meeting_chunk_status AS ENUM (
  'pending',
  'uploaded',
  'failed'
);

-- ──────────────────────────────────────────────────────────────────────────
-- meeting_recordings
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meeting_recordings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id UUID REFERENCES public.notes(id) ON DELETE SET NULL,
  daily_briefing_note_id UUID REFERENCES public.notes(id) ON DELETE SET NULL,
  calendar_event_id TEXT,
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  subject TEXT,
  objective TEXT,
  status public.meeting_status NOT NULL DEFAULT 'recording',
  failed_stage public.meeting_failed_stage,
  captured_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  consent_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  language TEXT,
  provider TEXT DEFAULT 'gemini',
  provider_transcript_id TEXT,
  fallback_reason TEXT,
  final_audio_r2_key TEXT,
  final_audio_mime_type TEXT,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  failure_reason TEXT,
  attempts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_meeting_recordings_user ON public.meeting_recordings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_recordings_status ON public.meeting_recordings(status) WHERE status IN ('processing', 'reanalyzing', 'awaiting_retry');

ALTER TABLE public.meeting_recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own meeting recordings"
  ON public.meeting_recordings
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trigger_update_meeting_recordings_updated_at
BEFORE UPDATE ON public.meeting_recordings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- meeting_recording_chunks
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meeting_recording_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_recording_id UUID NOT NULL REFERENCES public.meeting_recordings(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  size_bytes BIGINT,
  upload_status public.meeting_chunk_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (meeting_recording_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_meeting_chunks_recording ON public.meeting_recording_chunks(meeting_recording_id, sequence_number);

ALTER TABLE public.meeting_recording_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage chunks via the parent meeting"
  ON public.meeting_recording_chunks
  USING (EXISTS (SELECT 1 FROM public.meeting_recordings m WHERE m.id = meeting_recording_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.meeting_recordings m WHERE m.id = meeting_recording_id AND m.user_id = auth.uid()));

-- ──────────────────────────────────────────────────────────────────────────
-- meeting_speakers
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meeting_speakers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_recording_id UUID NOT NULL REFERENCES public.meeting_recordings(id) ON DELETE CASCADE,
  provider_label TEXT NOT NULL,
  display_label TEXT NOT NULL,
  person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  suggested_person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  identity_status public.meeting_identity_status NOT NULL DEFAULT 'unknown',
  confidence NUMERIC(4, 3),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (meeting_recording_id, provider_label)
);

CREATE INDEX IF NOT EXISTS idx_meeting_speakers_meeting ON public.meeting_speakers(meeting_recording_id);

ALTER TABLE public.meeting_speakers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage speakers via the parent meeting"
  ON public.meeting_speakers
  USING (EXISTS (SELECT 1 FROM public.meeting_recordings m WHERE m.id = meeting_recording_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.meeting_recordings m WHERE m.id = meeting_recording_id AND m.user_id = auth.uid()));

CREATE TRIGGER trigger_update_meeting_speakers_updated_at
BEFORE UPDATE ON public.meeting_speakers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- meeting_transcript_segments
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meeting_transcript_segments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_recording_id UUID NOT NULL REFERENCES public.meeting_recordings(id) ON DELETE CASCADE,
  meeting_speaker_id UUID REFERENCES public.meeting_speakers(id) ON DELETE SET NULL,
  sequence_number INTEGER NOT NULL,
  start_seconds NUMERIC(10, 3) NOT NULL,
  end_seconds NUMERIC(10, 3) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (meeting_recording_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_meeting_segments_meeting_seq ON public.meeting_transcript_segments(meeting_recording_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_meeting_segments_speaker ON public.meeting_transcript_segments(meeting_speaker_id);

ALTER TABLE public.meeting_transcript_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage segments via the parent meeting"
  ON public.meeting_transcript_segments
  USING (EXISTS (SELECT 1 FROM public.meeting_recordings m WHERE m.id = meeting_recording_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.meeting_recordings m WHERE m.id = meeting_recording_id AND m.user_id = auth.uid()));

-- ──────────────────────────────────────────────────────────────────────────
-- meeting_tasks
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meeting_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_recording_id UUID NOT NULL REFERENCES public.meeting_recordings(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  assignee_person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  status public.meeting_task_status NOT NULL DEFAULT 'suggested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_tasks_meeting ON public.meeting_tasks(meeting_recording_id);

ALTER TABLE public.meeting_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage tasks via the parent meeting"
  ON public.meeting_tasks
  USING (EXISTS (SELECT 1 FROM public.meeting_recordings m WHERE m.id = meeting_recording_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.meeting_recordings m WHERE m.id = meeting_recording_id AND m.user_id = auth.uid()));

CREATE TRIGGER trigger_update_meeting_tasks_updated_at
BEFORE UPDATE ON public.meeting_tasks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- meeting_speaker_corrections
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meeting_speaker_corrections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_recording_id UUID NOT NULL REFERENCES public.meeting_recordings(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  correction_audio_r2_key TEXT NOT NULL,
  correction_text TEXT,
  prior_speaker_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied_speaker_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied_segment_changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.meeting_correction_status NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at TIMESTAMPTZ,
  UNIQUE (meeting_recording_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_meeting_corrections_meeting ON public.meeting_speaker_corrections(meeting_recording_id, sequence_number);

ALTER TABLE public.meeting_speaker_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage corrections via the parent meeting"
  ON public.meeting_speaker_corrections
  USING (EXISTS (SELECT 1 FROM public.meeting_recordings m WHERE m.id = meeting_recording_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.meeting_recordings m WHERE m.id = meeting_recording_id AND m.user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';
