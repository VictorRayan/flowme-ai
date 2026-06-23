-- 061_free_ai_credit_limit.sql
-- Reduce the Free daily AI allowance from 10 to 5 and keep the RPC driven by plan metadata.

UPDATE public.subscription_plans
SET
  metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{ai_daily_credits}', '5'::jsonb, true),
  updated_at = NOW()
WHERE code = 'free';

UPDATE public.subscription_plan_localizations
SET
  feature_highlights = CASE locale
    WHEN 'en-US' THEN '["Smart notes", "5 AI credits per day"]'::jsonb
    ELSE '["Notas inteligentes", "5 créditos de IA por dia"]'::jsonb
  END,
  updated_at = NOW()
WHERE plan_code = 'free';

UPDATE public.user_entitlements
SET
  ai_credits = '{"unlimited": false, "daily_limit": 5, "label": "5 créditos de IA por dia"}'::jsonb,
  updated_at = NOW()
WHERE plan_code = 'free' OR has_pro = false;

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
  free_daily_limit INTEGER;
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

  SELECT GREATEST(1, COALESCE((metadata->>'ai_daily_credits')::INTEGER, 5))
  INTO free_daily_limit
  FROM public.subscription_plans
  WHERE code = 'free';
  free_daily_limit := COALESCE(free_daily_limit, 5);

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

  IF NOT has_unlimited AND used_credits + p_credits > free_daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'plan_code', 'free',
      'unlimited', false,
      'daily_limit', free_daily_limit,
      'used', used_credits,
      'remaining', GREATEST(0, free_daily_limit - used_credits),
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
    'daily_limit', CASE WHEN has_unlimited THEN NULL ELSE free_daily_limit END,
    'used', used_credits,
    'remaining', CASE WHEN has_unlimited THEN NULL ELSE GREATEST(0, free_daily_limit - used_credits) END,
    'local_date', local_date,
    'timezone', resolved_timezone,
    'resets_at', reset_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_credits(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, INTEGER, NUMERIC, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_ai_credits(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, INTEGER, INTEGER, NUMERIC, JSONB) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
