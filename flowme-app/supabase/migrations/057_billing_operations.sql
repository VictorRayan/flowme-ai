-- 057_billing_operations.sql
-- Internal alerts and reconciliation audit trail for billing operations.

DROP INDEX IF EXISTS public.idx_user_subscriptions_stripe_subscription;
DROP INDEX IF EXISTS public.idx_user_subscriptions_apple_original_transaction;
DROP INDEX IF EXISTS public.idx_user_subscriptions_google_purchase_token;

CREATE UNIQUE INDEX idx_user_subscriptions_stripe_subscription
  ON public.user_subscriptions (billing_provider, provider_subscription_id);
CREATE UNIQUE INDEX idx_user_subscriptions_apple_original_transaction
  ON public.user_subscriptions (billing_provider, provider_original_transaction_id);
CREATE UNIQUE INDEX idx_user_subscriptions_google_purchase_token
  ON public.user_subscriptions (billing_provider, provider_purchase_token);

CREATE TABLE IF NOT EXISTS public.billing_admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('webhook_failure', 'subscription_mismatch', 'high_ai_cost', 'cancellation_request', 'payment_failure')),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider TEXT CHECK (provider IN ('stripe', 'apple', 'google')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  dedupe_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_admin_alerts_dedupe
  ON public.billing_admin_alerts (dedupe_key);

CREATE INDEX IF NOT EXISTS idx_billing_admin_alerts_status_created
  ON public.billing_admin_alerts (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.billing_reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT CHECK (provider IN ('stripe', 'apple', 'google')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  inspected INTEGER NOT NULL DEFAULT 0,
  matched INTEGER NOT NULL DEFAULT 0,
  repaired INTEGER NOT NULL DEFAULT 0,
  mismatched INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.billing_reconciliation_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.billing_reconciliation_runs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'apple', 'google')),
  subscription_id UUID REFERENCES public.user_subscriptions(id) ON DELETE SET NULL,
  issue_type TEXT NOT NULL,
  local_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  repaired BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.billing_admin_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_reconciliation_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_admin_alerts_no_client_access ON public.billing_admin_alerts;
CREATE POLICY billing_admin_alerts_no_client_access ON public.billing_admin_alerts FOR SELECT USING (false);
DROP POLICY IF EXISTS billing_reconciliation_runs_no_client_access ON public.billing_reconciliation_runs;
CREATE POLICY billing_reconciliation_runs_no_client_access ON public.billing_reconciliation_runs FOR SELECT USING (false);
DROP POLICY IF EXISTS billing_reconciliation_issues_no_client_access ON public.billing_reconciliation_issues;
CREATE POLICY billing_reconciliation_issues_no_client_access ON public.billing_reconciliation_issues FOR SELECT USING (false);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_admin_alerts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_reconciliation_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_reconciliation_issues TO service_role;

NOTIFY pgrst, 'reload schema';
