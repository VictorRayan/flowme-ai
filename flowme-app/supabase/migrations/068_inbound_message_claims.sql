CREATE TABLE IF NOT EXISTS public.inbound_message_events (
  source TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  PRIMARY KEY (source, sender_id, message_id)
);

ALTER TABLE public.inbound_message_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inbound_message_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.inbound_message_events TO service_role;

CREATE OR REPLACE FUNCTION public.claim_inbound_message(
  p_source TEXT, p_sender_id TEXT, p_message_id TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claimed TEXT;
  already_processed BOOLEAN;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_source <> 'evolution' OR NULLIF(p_sender_id, '') IS NULL OR NULLIF(p_message_id, '') IS NULL THEN
    RAISE EXCEPTION 'Invalid inbound message identity';
  END IF;

  INSERT INTO public.inbound_message_events (source, sender_id, message_id)
  VALUES (p_source, p_sender_id, p_message_id)
  ON CONFLICT (source, sender_id, message_id) DO UPDATE
    SET claimed_at = NOW()
    WHERE inbound_message_events.processed_at IS NULL
      AND inbound_message_events.claimed_at < NOW() - INTERVAL '5 minutes'
  RETURNING 'claimed' INTO claimed;

  IF claimed IS NOT NULL THEN RETURN claimed; END IF;

  SELECT processed_at IS NOT NULL INTO already_processed
  FROM public.inbound_message_events
  WHERE source = p_source AND sender_id = p_sender_id AND message_id = p_message_id;

  RETURN CASE WHEN already_processed THEN 'processed' ELSE 'in_progress' END;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_inbound_message(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_inbound_message(TEXT, TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
