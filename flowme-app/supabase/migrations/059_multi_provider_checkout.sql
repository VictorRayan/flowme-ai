-- 059_multi_provider_checkout.sql
-- Localized catalog, provider routing, and checkout attempts separated from entitlements.

ALTER TABLE public.subscription_prices DROP CONSTRAINT IF EXISTS subscription_prices_billing_provider_check;
ALTER TABLE public.subscription_prices ADD CONSTRAINT subscription_prices_billing_provider_check
  CHECK (billing_provider IN ('stripe', 'asaas', 'apple', 'google'));
ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_billing_provider_check;
ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_billing_provider_check
  CHECK (billing_provider IN ('stripe', 'asaas', 'apple', 'google'));
ALTER TABLE public.billing_events DROP CONSTRAINT IF EXISTS billing_events_provider_check;
ALTER TABLE public.billing_events ADD CONSTRAINT billing_events_provider_check
  CHECK (provider IN ('stripe', 'asaas', 'apple', 'google'));
ALTER TABLE public.billing_notifications DROP CONSTRAINT IF EXISTS billing_notifications_provider_check;
ALTER TABLE public.billing_notifications ADD CONSTRAINT billing_notifications_provider_check
  CHECK (provider IN ('stripe', 'asaas', 'apple', 'google'));
ALTER TABLE public.subscription_cancellation_requests DROP CONSTRAINT IF EXISTS subscription_cancellation_requests_billing_provider_check;
ALTER TABLE public.subscription_cancellation_requests ADD CONSTRAINT subscription_cancellation_requests_billing_provider_check
  CHECK (billing_provider IN ('stripe', 'asaas', 'apple', 'google'));
ALTER TABLE public.billing_admin_alerts DROP CONSTRAINT IF EXISTS billing_admin_alerts_provider_check;
ALTER TABLE public.billing_admin_alerts ADD CONSTRAINT billing_admin_alerts_provider_check
  CHECK (provider IN ('stripe', 'asaas', 'apple', 'google'));
ALTER TABLE public.billing_reconciliation_runs DROP CONSTRAINT IF EXISTS billing_reconciliation_runs_provider_check;
ALTER TABLE public.billing_reconciliation_runs ADD CONSTRAINT billing_reconciliation_runs_provider_check
  CHECK (provider IN ('stripe', 'asaas', 'apple', 'google'));
ALTER TABLE public.billing_reconciliation_issues DROP CONSTRAINT IF EXISTS billing_reconciliation_issues_provider_check;
ALTER TABLE public.billing_reconciliation_issues ADD CONSTRAINT billing_reconciliation_issues_provider_check
  CHECK (provider IN ('stripe', 'asaas', 'apple', 'google'));

ALTER TABLE public.billing_events ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.subscription_plan_localizations (
  plan_code TEXT NOT NULL REFERENCES public.subscription_plans(code) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('pt-BR', 'en-US')),
  name TEXT NOT NULL,
  short_description TEXT NOT NULL,
  description TEXT NOT NULL,
  checkout_badge TEXT,
  checkout_cta TEXT NOT NULL,
  feature_highlights JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(feature_highlights) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (plan_code, locale)
);

CREATE TABLE IF NOT EXISTS public.billing_payment_method_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'card', 'apple_pay', 'google_pay')),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'asaas')),
  currency TEXT NOT NULL DEFAULT 'BRL',
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 100 CHECK (priority >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (payment_method, provider, currency)
);

CREATE TABLE IF NOT EXISTS public.billing_checkout_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL REFERENCES public.subscription_plans(code),
  price_id UUID NOT NULL REFERENCES public.subscription_prices(id),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'asaas')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'card', 'apple_pay', 'google_pay')),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly', 'annual')),
  locale TEXT NOT NULL CHECK (locale IN ('pt-BR', 'en-US')),
  currency TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'awaiting_payment', 'paid', 'past_due', 'failed', 'canceled', 'refunded', 'expired')),
  provider_customer_id TEXT,
  provider_checkout_id TEXT,
  provider_subscription_id TEXT,
  provider_payment_id TEXT,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  last_provider_event_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_checkout_attempts_user_created
  ON public.billing_checkout_attempts (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_checkout_attempts_provider_checkout
  ON public.billing_checkout_attempts (provider, provider_checkout_id)
  WHERE provider_checkout_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_checkout_attempts_provider_payment
  ON public.billing_checkout_attempts (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

INSERT INTO public.subscription_plan_localizations
  (plan_code, locale, name, short_description, description, checkout_badge, checkout_cta, feature_highlights)
VALUES
  ('free', 'pt-BR', 'Flow Me Free', 'Organize suas notas e conheça a Balys.', 'Comece a organizar sua vida com notas e créditos diários de IA.', NULL, 'Continuar no Free', '["Notas inteligentes", "5 créditos de IA por dia"]'::jsonb),
  ('free', 'en-US', 'Flow Me Free', 'Organize your notes and meet Balys.', 'Start organizing your life with notes and daily AI credits.', NULL, 'Continue with Free', '["Smart notes", "5 AI credits per day"]'::jsonb),
  ('pro', 'pt-BR', 'Flow Me Pro', 'Sua vida inteira fluindo em um só lugar.', 'Desbloqueie IA ilimitada, calendário, metas, finanças, conectores, automações, reuniões e muito mais.', 'Mais escolhido', 'Desbloquear meu Flow Me', '["Créditos de IA ilimitados", "Calendário, Today, metas e finanças", "Conectores, WhatsApp e automações", "Revisões, reuniões e geração de imagens"]'::jsonb),
  ('pro', 'en-US', 'Flow Me Pro', 'Your whole life flowing in one place.', 'Unlock unlimited AI, calendar, goals, finances, connectors, automations, meetings, and more.', 'Most popular', 'Unlock my Flow Me', '["Unlimited AI credits", "Calendar, Today, goals, and finances", "Connectors, WhatsApp, and automations", "Reviews, meetings, and image generation"]'::jsonb)
ON CONFLICT (plan_code, locale) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  description = EXCLUDED.description,
  checkout_badge = EXCLUDED.checkout_badge,
  checkout_cta = EXCLUDED.checkout_cta,
  feature_highlights = EXCLUDED.feature_highlights,
  updated_at = NOW();

INSERT INTO public.subscription_prices
  (plan_code, billing_provider, billing_interval, currency, amount_cents, provider_price_id, metadata)
VALUES
  ('pro', 'asaas', 'monthly', 'BRL', 5990, 'asaas_pro_monthly', '{"display_price":"R$59,90"}'::jsonb),
  ('pro', 'asaas', 'annual', 'BRL', 47880, 'asaas_pro_annual', '{"display_price":"R$39,90/mês no anual"}'::jsonb)
ON CONFLICT (billing_provider, provider_price_id) DO UPDATE SET
  amount_cents = EXCLUDED.amount_cents,
  active = true,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

INSERT INTO public.billing_payment_method_routes (payment_method, provider, currency, priority)
VALUES
  ('pix', 'asaas', 'BRL', 10),
  ('card', 'stripe', 'BRL', 10),
  ('apple_pay', 'stripe', 'BRL', 10),
  ('google_pay', 'stripe', 'BRL', 10)
ON CONFLICT (payment_method, provider, currency) DO UPDATE SET
  enabled = true,
  priority = EXCLUDED.priority,
  updated_at = NOW();

ALTER TABLE public.subscription_plan_localizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payment_method_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_checkout_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_plan_localizations_read_all ON public.subscription_plan_localizations;
CREATE POLICY subscription_plan_localizations_read_all ON public.subscription_plan_localizations FOR SELECT USING (true);
DROP POLICY IF EXISTS billing_payment_method_routes_read_enabled ON public.billing_payment_method_routes;
CREATE POLICY billing_payment_method_routes_read_enabled ON public.billing_payment_method_routes FOR SELECT USING (enabled = true);
DROP POLICY IF EXISTS billing_checkout_attempts_owner_read ON public.billing_checkout_attempts;
CREATE POLICY billing_checkout_attempts_owner_read ON public.billing_checkout_attempts FOR SELECT USING (auth.uid() = user_id);

GRANT SELECT ON public.subscription_plan_localizations TO anon, authenticated, service_role;
GRANT SELECT ON public.billing_payment_method_routes TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_checkout_attempts TO service_role;

NOTIFY pgrst, 'reload schema';
