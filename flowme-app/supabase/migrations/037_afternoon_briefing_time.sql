-- 037_afternoon_briefing_time.sql
-- Adds the afternoon ("Boa tarde") briefing slot alongside morning and evening,
-- so the scheduler can fire a midday briefing at a user-configured time.

ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS afternoon_briefing_time TEXT;

CREATE INDEX IF NOT EXISTS idx_user_profile_afternoon_time
  ON public.user_profile (afternoon_briefing_time)
  WHERE daily_routine_enabled = true AND afternoon_briefing_time IS NOT NULL;

NOTIFY pgrst, 'reload schema';
