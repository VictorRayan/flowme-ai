-- 050_subscription_entitlements.sql
-- Provider-agnostic subscription and entitlement foundation.

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  code TEXT PRIMARY KEY CHECK (code IN ('free', 'pro')),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subscription_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code TEXT NOT NULL REFERENCES public.subscription_plans(code),
  billing_provider TEXT NOT NULL CHECK (billing_provider IN ('stripe', 'apple', 'google')),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly', 'annual')),
  currency TEXT NOT NULL DEFAULT 'BRL',
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  provider_product_id TEXT,
  provider_price_id TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (billing_provider, provider_price_id)
);

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL DEFAULT 'free' REFERENCES public.subscription_plans(code),
  billing_provider TEXT NOT NULL DEFAULT 'stripe' CHECK (billing_provider IN ('stripe', 'apple', 'google')),
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  provider_original_transaction_id TEXT,
  provider_purchase_token TEXT,
  status TEXT NOT NULL DEFAULT 'free'
    CHECK (status IN ('free', 'trialing', 'active', 'past_due', 'grace_period', 'account_hold', 'canceled', 'expired', 'incomplete')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  grace_period_ends_at TIMESTAMPTZ,
  last_payment_failure_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status
  ON public.user_subscriptions (user_id, status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_subscription
  ON public.user_subscriptions (billing_provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_apple_original_transaction
  ON public.user_subscriptions (billing_provider, provider_original_transaction_id)
  WHERE provider_original_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_google_purchase_token
  ON public.user_subscriptions (billing_provider, provider_purchase_token)
  WHERE provider_purchase_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_entitlements (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL DEFAULT 'free' REFERENCES public.subscription_plans(code),
  has_pro BOOLEAN NOT NULL DEFAULT false,
  billing_state TEXT NOT NULL DEFAULT 'free',
  access_until TIMESTAMPTZ,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_credits JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'apple', 'google')),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, event_id)
);

CREATE TABLE IF NOT EXISTS public.billing_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  provider TEXT CHECK (provider IN ('stripe', 'apple', 'google')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'dismissed')),
  channels_attempted TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

INSERT INTO public.subscription_plans (code, name, status, metadata)
VALUES
  ('free', 'Free', 'active', '{"ai_daily_credits": 5}'::jsonb),
  ('pro', 'Pro', 'active', '{"ai_credits": "unlimited"}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO public.subscription_prices (plan_code, billing_provider, billing_interval, currency, amount_cents, provider_product_id, provider_price_id, metadata)
VALUES
  ('pro', 'stripe', 'monthly', 'BRL', 5990, NULL, 'stripe_pro_monthly_pending', '{"display_price": "R$59,90"}'::jsonb),
  ('pro', 'stripe', 'annual', 'BRL', 47880, NULL, 'stripe_pro_annual_pending', '{"display_price": "R$39,90/mês no anual"}'::jsonb),
  ('pro', 'apple', 'monthly', 'BRL', 5990, NULL, 'apple_pro_monthly_pending', '{"pending_store_setup": true}'::jsonb),
  ('pro', 'apple', 'annual', 'BRL', 47880, NULL, 'apple_pro_annual_pending', '{"pending_store_setup": true}'::jsonb),
  ('pro', 'google', 'monthly', 'BRL', 5990, NULL, 'google_pro_monthly_pending', '{"pending_store_setup": true}'::jsonb),
  ('pro', 'google', 'annual', 'BRL', 47880, NULL, 'google_pro_annual_pending', '{"pending_store_setup": true}'::jsonb)
ON CONFLICT (billing_provider, provider_price_id) DO UPDATE SET
  plan_code = EXCLUDED.plan_code,
  billing_interval = EXCLUDED.billing_interval,
  currency = EXCLUDED.currency,
  amount_cents = EXCLUDED.amount_cents,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_plans_read_all ON public.subscription_plans;
CREATE POLICY subscription_plans_read_all
  ON public.subscription_plans
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS subscription_prices_read_all_active ON public.subscription_prices;
CREATE POLICY subscription_prices_read_all_active
  ON public.subscription_prices
  FOR SELECT
  USING (active = true);

DROP POLICY IF EXISTS user_subscriptions_owner_read ON public.user_subscriptions;
CREATE POLICY user_subscriptions_owner_read
  ON public.user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_entitlements_owner_read ON public.user_entitlements;
CREATE POLICY user_entitlements_owner_read
  ON public.user_entitlements
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS billing_notifications_owner_read_update ON public.billing_notifications;
CREATE POLICY billing_notifications_owner_read_update
  ON public.billing_notifications
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS billing_events_no_client_access ON public.billing_events;
CREATE POLICY billing_events_no_client_access
  ON public.billing_events
  FOR SELECT
  USING (false);

NOTIFY pgrst, 'reload schema';
