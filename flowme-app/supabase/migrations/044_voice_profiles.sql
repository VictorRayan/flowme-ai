-- 044_voice_profiles.sql
-- Optional voice profiles per person. Phase 3 of the meeting-recording plan.
-- Profiles are sensitive personal data (biometric) and are stored only after
-- the user explicitly opts in AND consents per profile.

CREATE TYPE public.voice_profile_status AS ENUM ('active', 'archived');

CREATE TABLE IF NOT EXISTS public.voice_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  reference_audio_r2_key TEXT NOT NULL,
  reference_mime_type TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  status public.voice_profile_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_voice_profiles_user ON public.voice_profiles(user_id);

ALTER TABLE public.voice_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own voice profiles"
  ON public.voice_profiles
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trigger_update_voice_profiles_updated_at
BEFORE UPDATE ON public.voice_profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Opt-in flag on user_profile so the feature is OFF by default.
ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS voice_profiles_enabled BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
