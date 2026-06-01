-- 046_weekly_reviews.sql
-- Stores deterministic evidence and Council-backed mentorship reviews.

CREATE TABLE IF NOT EXISTS public.weekly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'collecting'
    CHECK (status IN ('collecting', 'awaiting_briefing', 'generating', 'ready', 'failed')),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  review_content JSONB,
  suggested_action_plan JSONB,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_weekly_reviews_user_period
  ON public.weekly_reviews (user_id, period_end DESC);

ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weekly_reviews_owner_all ON public.weekly_reviews;
CREATE POLICY weekly_reviews_owner_all
  ON public.weekly_reviews
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
