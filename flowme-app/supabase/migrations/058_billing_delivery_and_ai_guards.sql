ALTER TABLE public.billing_notifications
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS channel_results JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_billing_notifications_delivery
  ON public.billing_notifications (status, next_attempt_at, created_at)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.claim_billing_notifications(p_limit INTEGER DEFAULT 20)
RETURNS SETOF public.billing_notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.billing_notifications
    WHERE status = 'pending'
      AND next_attempt_at <= NOW()
      AND (processing_started_at IS NULL OR processing_started_at < NOW() - INTERVAL '10 minutes')
    ORDER BY next_attempt_at, created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
  )
  UPDATE public.billing_notifications notification
  SET processing_started_at = NOW(), updated_at = NOW()
  FROM candidates
  WHERE notification.id = candidates.id
  RETURNING notification.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_billing_notifications(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_billing_notifications(INTEGER) TO service_role;

CREATE TABLE IF NOT EXISTS public.ai_guard_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workload TEXT NOT NULL,
  expensive BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_guard_events_user_created
  ON public.ai_guard_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_guard_events_user_workload_expensive
  ON public.ai_guard_events (user_id, workload, created_at DESC)
  WHERE expensive = true;

CREATE TABLE IF NOT EXISTS public.ai_guard_leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workload TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_guard_leases_active
  ON public.ai_guard_leases (user_id, expires_at)
  WHERE released_at IS NULL;

ALTER TABLE public.ai_guard_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_guard_leases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_guard_events_no_client_access ON public.ai_guard_events;
CREATE POLICY ai_guard_events_no_client_access ON public.ai_guard_events FOR SELECT USING (false);
DROP POLICY IF EXISTS ai_guard_leases_no_client_access ON public.ai_guard_leases;
CREATE POLICY ai_guard_leases_no_client_access ON public.ai_guard_leases FOR SELECT USING (false);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_guard_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_guard_leases TO service_role;

CREATE OR REPLACE FUNCTION public.acquire_ai_usage_guard(
  p_user_id UUID,
  p_workload TEXT,
  p_expensive BOOLEAN,
  p_requests_per_minute INTEGER,
  p_daily_expensive_limit INTEGER,
  p_concurrency_limit INTEGER,
  p_lease_seconds INTEGER DEFAULT 900
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  minute_count INTEGER;
  daily_count INTEGER;
  concurrent_count INTEGER;
  lease_id UUID;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ai-guard:' || p_user_id::TEXT, 0));

  SELECT COUNT(*)::INTEGER INTO minute_count
  FROM public.ai_guard_events
  WHERE user_id = p_user_id AND created_at >= NOW() - INTERVAL '1 minute';

  IF minute_count >= GREATEST(p_requests_per_minute, 1) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'rate', 'retry_after_seconds', 60);
  END IF;

  IF p_expensive THEN
    SELECT COUNT(*)::INTEGER INTO daily_count
    FROM public.ai_guard_events
    WHERE user_id = p_user_id
      AND workload = p_workload
      AND expensive = true
      AND created_at >= NOW() - INTERVAL '24 hours';

    IF daily_count >= GREATEST(p_daily_expensive_limit, 1) THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'daily', 'retry_after_seconds', 3600);
    END IF;

    SELECT COUNT(*)::INTEGER INTO concurrent_count
    FROM public.ai_guard_leases
    WHERE user_id = p_user_id AND released_at IS NULL AND expires_at > NOW();

    IF concurrent_count >= GREATEST(p_concurrency_limit, 1) THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'concurrency', 'retry_after_seconds', 15);
    END IF;
  END IF;

  INSERT INTO public.ai_guard_events (user_id, workload, expensive)
  VALUES (p_user_id, p_workload, p_expensive);

  IF p_expensive THEN
    INSERT INTO public.ai_guard_leases (user_id, workload, expires_at)
    VALUES (p_user_id, p_workload, NOW() + make_interval(secs => LEAST(GREATEST(p_lease_seconds, 30), 3600)))
    RETURNING id INTO lease_id;
  END IF;

  RETURN jsonb_build_object('allowed', true, 'lease_id', lease_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_ai_usage_guard(p_lease_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE public.ai_guard_leases SET released_at = NOW() WHERE id = p_lease_id AND released_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_ai_usage_guard(UUID, TEXT, BOOLEAN, INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_ai_usage_guard(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_ai_usage_guard(UUID, TEXT, BOOLEAN, INTEGER, INTEGER, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_ai_usage_guard(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
