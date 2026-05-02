-- ============================================================
-- Migration: 020_user_profile
-- Description: Tier C cross-thread memory — the "living" user profile.
--              One JSON row per user, updated by Balys as conversations
--              happen. Loaded into every system prompt.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_profile (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INT NOT NULL DEFAULT 1,
    last_updated_at TIMESTAMPTZ DEFAULT now(),
    last_validated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profile;
CREATE POLICY "Users can view their own profile"
    ON public.user_profile FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profile;
CREATE POLICY "Users can insert their own profile"
    ON public.user_profile FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profile;
CREATE POLICY "Users can update their own profile"
    ON public.user_profile FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own profile" ON public.user_profile;
CREATE POLICY "Users can delete their own profile"
    ON public.user_profile FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trigger_update_user_profile_updated_at ON public.user_profile;
CREATE TRIGGER trigger_update_user_profile_updated_at
BEFORE UPDATE ON public.user_profile
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
