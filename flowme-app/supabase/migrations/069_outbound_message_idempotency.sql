CREATE TABLE IF NOT EXISTS public.outbound_message_events (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('slack', 'gmail')),
  payload_hash TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  receipt JSONB,
  PRIMARY KEY (user_id, request_id, provider, payload_hash)
);

ALTER TABLE public.outbound_message_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.outbound_message_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.outbound_message_events TO service_role;

CREATE OR REPLACE FUNCTION public.claim_outbound_message(
  p_user_id UUID, p_request_id TEXT, p_provider TEXT, p_payload_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claim JSONB;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NULLIF(p_request_id, '') IS NULL OR p_provider NOT IN ('slack', 'gmail')
    OR p_payload_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid outbound operation identity';
  END IF;

  INSERT INTO public.outbound_message_events (user_id, request_id, provider, payload_hash)
  VALUES (p_user_id, p_request_id, p_provider, p_payload_hash)
  ON CONFLICT DO NOTHING
  RETURNING jsonb_build_object('status', 'claimed') INTO claim;
  IF claim IS NOT NULL THEN RETURN claim; END IF;

  SELECT CASE WHEN completed_at IS NOT NULL
    THEN jsonb_build_object('status', 'completed', 'receipt', receipt)
    ELSE jsonb_build_object('status', 'in_progress') END
  INTO claim
  FROM public.outbound_message_events
  WHERE user_id = p_user_id AND request_id = p_request_id
    AND provider = p_provider AND payload_hash = p_payload_hash;
  RETURN claim;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_outbound_message(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_outbound_message(UUID, TEXT, TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
