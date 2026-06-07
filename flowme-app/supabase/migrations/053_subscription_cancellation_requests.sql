-- 053_subscription_cancellation_requests.sql
-- Cancellation requests created by the support retention funnel.

CREATE TABLE IF NOT EXISTS public.subscription_cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.user_subscriptions(id) ON DELETE SET NULL,
  billing_provider TEXT CHECK (billing_provider IN ('stripe', 'apple', 'google')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_review', 'retained', 'approved_cancel', 'canceled', 'closed')),
  reason TEXT NOT NULL CHECK (char_length(reason) >= 100),
  disappointing_features TEXT NOT NULL CHECK (char_length(disappointing_features) >= 10),
  unmet_expectation TEXT NOT NULL CHECK (char_length(unmet_expectation) >= 10),
  would_accept_human_support BOOLEAN NOT NULL,
  source TEXT NOT NULL DEFAULT 'support_balys' CHECK (source IN ('support_balys', 'billing_page', 'mobile')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_subscription_cancellation_requests_user_created
  ON public.subscription_cancellation_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_cancellation_requests_status_created
  ON public.subscription_cancellation_requests (status, created_at DESC);

ALTER TABLE public.subscription_cancellation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_cancellation_requests_owner_read ON public.subscription_cancellation_requests;
CREATE POLICY subscription_cancellation_requests_owner_read
  ON public.subscription_cancellation_requests
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS subscription_cancellation_requests_owner_insert ON public.subscription_cancellation_requests;
CREATE POLICY subscription_cancellation_requests_owner_insert
  ON public.subscription_cancellation_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
