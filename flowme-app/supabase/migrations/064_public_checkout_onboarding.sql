-- 064_public_checkout_onboarding.sql
-- Public checkout sessions by verified email, plus onboarding progress telemetry.

CREATE TABLE IF NOT EXISTS public.public_checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.marketing_leads(id) ON DELETE SET NULL,
  claimed_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  customer_name TEXT,
  phone TEXT,
  phone_e164 TEXT,
  plan_code TEXT NOT NULL REFERENCES public.subscription_plans(code),
  price_id UUID NOT NULL REFERENCES public.subscription_prices(id),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'asaas')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'card', 'apple_pay', 'google_pay')),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly', 'annual')),
  locale TEXT NOT NULL CHECK (locale IN ('pt-BR', 'en-US')),
  currency TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'awaiting_payment', 'paid', 'past_due', 'failed', 'canceled', 'refunded', 'expired', 'claimed')),
  source TEXT,
  provider_customer_id TEXT,
  provider_checkout_id TEXT,
  provider_subscription_id TEXT,
  provider_payment_id TEXT,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  last_provider_event_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_checkout_sessions_email_created
  ON public.public_checkout_sessions (lower(email), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_checkout_sessions_status_created
  ON public.public_checkout_sessions (status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_public_checkout_sessions_provider_checkout
  ON public.public_checkout_sessions (provider, provider_checkout_id)
  WHERE provider_checkout_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_public_checkout_sessions_provider_payment
  ON public.public_checkout_sessions (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.onboarding_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  session_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('started', 'step_viewed', 'step_completed', 'completed')),
  step_key TEXT NOT NULL,
  step_index INTEGER NOT NULL DEFAULT 0,
  locale TEXT CHECK (locale IN ('pt-BR', 'en-US')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_user_time
  ON public.onboarding_events (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_time
  ON public.onboarding_events (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_type_time
  ON public.onboarding_events (event_type, occurred_at DESC);

ALTER TABLE public.public_checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_checkout_sessions_no_client_access ON public.public_checkout_sessions;
CREATE POLICY public_checkout_sessions_no_client_access
  ON public.public_checkout_sessions
  FOR ALL
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS onboarding_events_no_client_access ON public.onboarding_events;
CREATE POLICY onboarding_events_no_client_access
  ON public.onboarding_events
  FOR ALL
  USING (false)
  WITH CHECK (false);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_checkout_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_events TO service_role;

NOTIFY pgrst, 'reload schema';
