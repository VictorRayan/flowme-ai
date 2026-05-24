-- 030_briefing_preferences.sql
-- Stores per-user daily routine config (morning/evening briefing times,
-- timezone, news topics, delivery channels) on user_profile as typed columns
-- so the scheduler can filter efficiently without parsing JSONB.

ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS morning_briefing_time TEXT,
  ADD COLUMN IF NOT EXISTS evening_briefing_time TEXT,
  ADD COLUMN IF NOT EXISTS briefing_timezone TEXT,
  ADD COLUMN IF NOT EXISTS news_topics TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS daily_routine_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS briefing_delivery TEXT[] DEFAULT ARRAY['web'],
  ADD COLUMN IF NOT EXISTS briefing_city TEXT;

CREATE INDEX IF NOT EXISTS idx_user_profile_morning_time
  ON public.user_profile (morning_briefing_time)
  WHERE daily_routine_enabled = true AND morning_briefing_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profile_evening_time
  ON public.user_profile (evening_briefing_time)
  WHERE daily_routine_enabled = true AND evening_briefing_time IS NOT NULL;

NOTIFY pgrst, 'reload schema';
