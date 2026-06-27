-- 061_support_requests.sql
-- Generic support requests for non-cancellation workflows.

CREATE TABLE IF NOT EXISTS public.support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('payment', 'account_access', 'bug', 'connectors', 'ai', 'feature_request', 'other')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'needs_info', 'resolved', 'closed')),
  subject TEXT NOT NULL,
  details TEXT NOT NULL,
  expected_outcome TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'pt-BR' CHECK (locale IN ('pt-BR', 'en-US')),
  source TEXT NOT NULL DEFAULT 'support_balys' CHECK (source IN ('support_balys', 'billing_page', 'mobile')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_requests_user_created
  ON public.support_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_requests_status_created
  ON public.support_requests (status, created_at DESC);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_requests_owner_read ON public.support_requests;
CREATE POLICY support_requests_owner_read
  ON public.support_requests
  FOR SELECT
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_requests TO service_role;

NOTIFY pgrst, 'reload schema';
