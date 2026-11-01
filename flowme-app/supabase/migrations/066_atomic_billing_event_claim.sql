CREATE OR REPLACE FUNCTION public.claim_billing_event(
  p_provider TEXT,
  p_event_id TEXT,
  p_event_type TEXT,
  p_payload JSONB,
  p_user_id UUID DEFAULT NULL,
  p_provider_customer_id TEXT DEFAULT NULL,
  p_provider_subscription_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claimed_id UUID;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.billing_events (
    provider, event_id, event_type, payload, user_id,
    provider_customer_id, provider_subscription_id, processing_started_at
  ) VALUES (
    p_provider, p_event_id, p_event_type, p_payload, p_user_id,
    p_provider_customer_id, p_provider_subscription_id, NOW()
  )
  ON CONFLICT (provider, event_id) DO UPDATE
    SET processing_started_at = NOW()
    WHERE billing_events.processed_at IS NULL
      AND (billing_events.processing_started_at IS NULL
        OR billing_events.processing_started_at < NOW() - INTERVAL '5 minutes')
  RETURNING id INTO claimed_id;

  RETURN claimed_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_billing_event(TEXT, TEXT, TEXT, JSONB, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_billing_event(TEXT, TEXT, TEXT, JSONB, UUID, TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
