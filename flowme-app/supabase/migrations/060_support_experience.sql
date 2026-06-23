-- 060_support_experience.sql
-- Controlled cancellation funnel, management decisions, audit, and subscription history.

CREATE TABLE IF NOT EXISTS public.app_user_roles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('support_manager', 'billing_manager', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.subscription_cancellation_funnel_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_stage TEXT NOT NULL CHECK (current_stage IN ('manage_subscription', 'payment_and_recurrence', 'cancel_subscription')),
  completed_stages TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  locale TEXT NOT NULL CHECK (locale IN ('pt-BR', 'en-US')),
  source TEXT NOT NULL DEFAULT 'support_balys' CHECK (source IN ('support_balys', 'billing_page', 'mobile')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cancellation_funnel_user_expires
  ON public.subscription_cancellation_funnel_sessions (user_id, expires_at DESC);

ALTER TABLE public.subscription_cancellation_requests
  ADD COLUMN IF NOT EXISTS reason_code TEXT,
  ADD COLUMN IF NOT EXISTS funnel_session_id UUID REFERENCES public.subscription_cancellation_funnel_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'pt-BR' CHECK (locale IN ('pt-BR', 'en-US')),
  ADD COLUMN IF NOT EXISTS decision TEXT CHECK (decision IN ('retained', 'rejected', 'approved_cancel')),
  ADD COLUMN IF NOT EXISTS decision_reason TEXT,
  ADD COLUMN IF NOT EXISTS decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_action_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (provider_action_status IN ('not_started', 'pending', 'completed', 'failed', 'store_action_required')),
  ADD COLUMN IF NOT EXISTS provider_action_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_action_error TEXT,
  ADD COLUMN IF NOT EXISTS provider_action_completed_at TIMESTAMPTZ;

UPDATE public.subscription_cancellation_requests SET reason_code = 'other' WHERE reason_code IS NULL;
ALTER TABLE public.subscription_cancellation_requests ALTER COLUMN reason_code SET NOT NULL;
ALTER TABLE public.subscription_cancellation_requests DROP CONSTRAINT IF EXISTS subscription_cancellation_requests_reason_code_check;
ALTER TABLE public.subscription_cancellation_requests
  ADD CONSTRAINT subscription_cancellation_requests_reason_code_check
  CHECK (reason_code IN ('price', 'technical_problem', 'not_using', 'unmet_expectation', 'privacy', 'other')) NOT VALID;
ALTER TABLE public.subscription_cancellation_requests VALIDATE CONSTRAINT subscription_cancellation_requests_reason_code_check;

ALTER TABLE public.subscription_cancellation_requests DROP CONSTRAINT IF EXISTS subscription_cancellation_requests_status_check;
ALTER TABLE public.subscription_cancellation_requests ADD CONSTRAINT subscription_cancellation_requests_status_check
  CHECK (status IN ('open', 'in_review', 'needs_info', 'retained', 'rejected', 'approved_cancel', 'canceling', 'canceled', 'provider_action_failed', 'closed'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_cancellation_requests_one_active_per_user
  ON public.subscription_cancellation_requests (user_id)
  WHERE status IN ('open', 'in_review', 'needs_info', 'approved_cancel', 'canceling', 'provider_action_failed');

CREATE TABLE IF NOT EXISTS public.subscription_cancellation_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.subscription_cancellation_requests(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cancellation_request_events_request_created
  ON public.subscription_cancellation_request_events (request_id, created_at);

CREATE TABLE IF NOT EXISTS public.user_plan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.user_subscriptions(id) ON DELETE SET NULL,
  plan_code TEXT NOT NULL REFERENCES public.subscription_plans(code),
  billing_provider TEXT CHECK (billing_provider IN ('stripe', 'asaas', 'apple', 'google')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  transition_reason TEXT,
  cancellation_request_id UUID REFERENCES public.subscription_cancellation_requests(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_plan_history_user_started
  ON public.user_plan_history (user_id, started_at DESC);

CREATE OR REPLACE FUNCTION public.track_user_plan_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_effective TEXT;
  new_effective TEXT;
BEGIN
  old_effective := CASE WHEN TG_OP = 'UPDATE' AND OLD.plan_code = 'pro' AND OLD.status IN ('trialing', 'active', 'past_due', 'grace_period') THEN 'pro' ELSE 'free' END;
  new_effective := CASE WHEN NEW.plan_code = 'pro' AND NEW.status IN ('trialing', 'active', 'past_due', 'grace_period') THEN 'pro' ELSE 'free' END;
  IF TG_OP = 'INSERT' OR old_effective IS DISTINCT FROM new_effective OR OLD.billing_provider IS DISTINCT FROM NEW.billing_provider THEN
    UPDATE public.user_plan_history SET ended_at = NOW(), transition_reason = COALESCE(transition_reason, 'subscription_transition')
      WHERE user_id = NEW.user_id AND ended_at IS NULL;
    INSERT INTO public.user_plan_history (user_id, subscription_id, plan_code, billing_provider, started_at, transition_reason)
      VALUES (NEW.user_id, NEW.id, new_effective, CASE WHEN new_effective = 'pro' THEN NEW.billing_provider ELSE NULL END, NOW(), 'subscription_transition');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_user_plan_history ON public.user_subscriptions;
CREATE TRIGGER trg_track_user_plan_history
AFTER INSERT OR UPDATE OF plan_code, status, billing_provider ON public.user_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.track_user_plan_history();

INSERT INTO public.user_plan_history (user_id, subscription_id, plan_code, billing_provider, started_at, transition_reason)
SELECT DISTINCT ON (subscription.user_id) subscription.user_id, subscription.id,
  CASE WHEN subscription.plan_code = 'pro' AND subscription.status IN ('trialing', 'active', 'past_due', 'grace_period') THEN 'pro' ELSE 'free' END,
  CASE WHEN subscription.plan_code = 'pro' AND subscription.status IN ('trialing', 'active', 'past_due', 'grace_period') THEN subscription.billing_provider ELSE NULL END,
  COALESCE(subscription.current_period_start, subscription.created_at), 'migration_backfill'
FROM public.user_subscriptions subscription
WHERE NOT EXISTS (SELECT 1 FROM public.user_plan_history history WHERE history.user_id = subscription.user_id)
ORDER BY subscription.user_id, subscription.updated_at DESC;

CREATE TABLE IF NOT EXISTS public.billing_revenue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.user_subscriptions(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'asaas', 'apple', 'google')),
  provider_event_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('payment_received', 'refund', 'chargeback')),
  currency TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_event_id, kind)
);

ALTER TABLE public.app_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_cancellation_funnel_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_cancellation_request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_plan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_revenue_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cancellation_funnel_owner_read ON public.subscription_cancellation_funnel_sessions;
CREATE POLICY cancellation_funnel_owner_read ON public.subscription_cancellation_funnel_sessions
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS plan_history_owner_read ON public.user_plan_history;
CREATE POLICY plan_history_owner_read ON public.user_plan_history
  FOR SELECT USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_cancellation_funnel_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_cancellation_request_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_plan_history TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_revenue_events TO service_role;

NOTIFY pgrst, 'reload schema';
