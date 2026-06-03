-- 048_monthly_finance_reviews.sql
-- Monthly finance reviews generated on the last day of each month.

ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS monthly_review_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS monthly_review_time TEXT NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS monthly_review_channels TEXT[] NOT NULL DEFAULT ARRAY['push'];

ALTER TABLE public.user_profile
  DROP CONSTRAINT IF EXISTS user_profile_monthly_review_time_check;

ALTER TABLE public.user_profile
  ADD CONSTRAINT user_profile_monthly_review_time_check
  CHECK (monthly_review_time IS NULL OR monthly_review_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE public.ritual_prompt_deliveries
  DROP CONSTRAINT IF EXISTS ritual_prompt_deliveries_ritual_kind_check;

ALTER TABLE public.ritual_prompt_deliveries
  ADD CONSTRAINT ritual_prompt_deliveries_ritual_kind_check
  CHECK (ritual_kind IN ('daily_briefing_note', 'weekly_review', 'monthly_review'));

CREATE TABLE IF NOT EXISTS public.monthly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'generating'
    CHECK (status IN ('generating', 'ready', 'failed')),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  review_content JSONB,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_monthly_reviews_user_period
  ON public.monthly_reviews (user_id, period_end DESC);

ALTER TABLE public.monthly_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS monthly_reviews_owner_all ON public.monthly_reviews;
CREATE POLICY monthly_reviews_owner_all
  ON public.monthly_reviews
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
