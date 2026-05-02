-- ============================================================
-- Migration: 017_user_settings_ai_behavior
-- Description: Add AI behavior knobs to user_settings:
--              council_mode (cheap | best) and memory_enabled.
-- ============================================================

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS council_mode TEXT NOT NULL DEFAULT 'cheap',
  ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_council_mode_check;

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_council_mode_check
  CHECK (council_mode IN ('cheap', 'best'));
