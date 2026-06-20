CREATE TABLE IF NOT EXISTS public.ai_credit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('chat', 'tool', 'briefing', 'review', 'image', 'meeting', 'support')),
  feature_key TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0),
  provider TEXT,
  model TEXT,
  estimated_input_tokens INTEGER CHECK (estimated_input_tokens IS NULL OR estimated_input_tokens >= 0),
  estimated_output_tokens INTEGER CHECK (estimated_output_tokens IS NULL OR estimated_output_tokens >= 0),
  actual_input_tokens INTEGER CHECK (actual_input_tokens IS NULL OR actual_input_tokens >= 0),
  actual_output_tokens INTEGER CHECK (actual_output_tokens IS NULL OR actual_output_tokens >= 0),
  cost_usd_estimate NUMERIC(12, 6) CHECK (cost_usd_estimate IS NULL OR cost_usd_estimate >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_credit_events_user_created
  ON public.ai_credit_events (user_id, created_at DESC);

ALTER TABLE public.ai_credit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_credit_events_owner_read ON public.ai_credit_events;
CREATE POLICY ai_credit_events_owner_read
  ON public.ai_credit_events
  FOR SELECT
  USING (auth.uid() = user_id);

GRANT SELECT ON public.ai_credit_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_credit_events TO service_role;

CREATE OR REPLACE FUNCTION public.consume_ai_credits(
  p_user_id UUID,
  p_timezone TEXT,
  p_source TEXT,
  p_feature_key TEXT,
  p_credits INTEGER,
  p_provider TEXT DEFAULT NULL,
  p_model TEXT DEFAULT NULL,
  p_estimated_input_tokens INTEGER DEFAULT NULL,
  p_estimated_output_tokens INTEGER DEFAULT NULL,
  p_cost_usd_estimate NUMERIC DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_timezone TEXT;
  local_date DATE;
  used_credits INTEGER;
  has_unlimited BOOLEAN;
  reset_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_credits <= 0 THEN
    RAISE EXCEPTION 'Credits must be positive';
  END IF;
  IF p_source NOT IN ('chat', 'tool', 'briefing', 'review', 'image', 'meeting', 'support') THEN
    RAISE EXCEPTION 'Invalid AI credit source';
  END IF;

  SELECT name INTO resolved_timezone
  FROM pg_timezone_names
  WHERE name = p_timezone
  LIMIT 1;
  resolved_timezone := COALESCE(resolved_timezone, 'UTC');
  local_date := (NOW() AT TIME ZONE resolved_timezone)::DATE;
  reset_at := ((local_date + 1)::TIMESTAMP AT TIME ZONE resolved_timezone);

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT || ':' || local_date::TEXT, 0));

  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions
    WHERE user_id = p_user_id
      AND plan_code = 'pro'
      AND (
        (status IN ('trialing', 'active') AND (current_period_end IS NULL OR current_period_end > NOW()))
        OR (status IN ('past_due', 'grace_period') AND COALESCE(grace_period_ends_at, current_period_end) > NOW())
      )
  ) INTO has_unlimited;

  SELECT COALESCE(SUM(credits), 0)::INTEGER INTO used_credits
  FROM public.ai_credit_events
  WHERE user_id = p_user_id
    AND (created_at AT TIME ZONE resolved_timezone)::DATE = local_date;

  IF NOT has_unlimited AND used_credits + p_credits > 10 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'plan_code', 'free',
      'unlimited', false,
      'daily_limit', 10,
      'used', used_credits,
      'remaining', GREATEST(0, 10 - used_credits),
      'local_date', local_date,
      'timezone', resolved_timezone,
      'resets_at', reset_at
    );
  END IF;

  INSERT INTO public.ai_credit_events (
    user_id, source, feature_key, credits, provider, model,
    estimated_input_tokens, estimated_output_tokens, cost_usd_estimate, metadata
  ) VALUES (
    p_user_id, p_source, p_feature_key, p_credits, p_provider, p_model,
    p_estimated_input_tokens, p_estimated_output_tokens, p_cost_usd_estimate, COALESCE(p_metadata, '{}'::jsonb)
  );

  used_credits := used_credits + p_credits;
  RETURN jsonb_build_object(
    'allowed', true,
    'plan_code', CASE WHEN has_unlimited THEN 'pro' ELSE 'free' END,
    'unlimited', has_unlimited,
    'daily_limit', CASE WHEN has_unlimited THEN NULL ELSE 10 END,
    'used', used_credits,
    'remaining', CASE WHEN has_unlimited THEN NULL ELSE GREATEST(0, 10 - used_credits) END,
    'local_date', local_date,
    'timezone', resolved_timezone,
    'resets_at', reset_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_credits(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, INTEGER, NUMERIC, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_ai_credits(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, INTEGER, NUMERIC, JSONB) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
