-- 038_slack_connector.sql
-- Adds Slack as a connector type and a per-user Slack token store,
-- mirroring the Google connector setup (014 + 003) so the existing
-- connectors UI and tool framework picks Slack up automatically.

-- 1) Extend the connector_type ENUM with 'slack'.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'connector_type' AND e.enumlabel = 'slack'
  ) THEN
    ALTER TYPE public.connector_type ADD VALUE 'slack';
  END IF;
END$$;

-- 2) Per-user Slack tokens, keyed by linked_account_id (RLS via ownership).
CREATE TABLE IF NOT EXISTS public.user_slack_tokens (
  linked_account_id UUID PRIMARY KEY REFERENCES public.linked_accounts(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,          -- xoxp user token
  refresh_token TEXT,                  -- only set when token rotation is enabled in the Slack app
  expiry TIMESTAMPTZ,                  -- NULL when rotation is off (Slack tokens don't expire by default)
  slack_team_id TEXT,
  slack_team_name TEXT,
  slack_user_id TEXT,
  scopes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_slack_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own slack tokens"
  ON public.user_slack_tokens
  USING (
    EXISTS (
      SELECT 1 FROM public.linked_accounts
      WHERE id = user_slack_tokens.linked_account_id
        AND user_id = auth.uid()
    )
  );

CREATE TRIGGER trigger_update_user_slack_tokens_updated_at
BEFORE UPDATE ON public.user_slack_tokens
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

NOTIFY pgrst, 'reload schema';
