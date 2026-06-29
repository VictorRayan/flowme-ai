-- 063_marketing_funnel.sql
-- Public landing/checkout funnel telemetry and lead capture.

CREATE TABLE IF NOT EXISTS public.marketing_page_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT,
  session_id TEXT,
  surface TEXT NOT NULL CHECK (surface IN ('landing', 'checkout')),
  locale TEXT NOT NULL CHECK (locale IN ('pt-BR', 'en-US')),
  path TEXT NOT NULL,
  source TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.marketing_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT,
  session_id TEXT,
  locale TEXT NOT NULL CHECK (locale IN ('pt-BR', 'en-US')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_e164 TEXT,
  path TEXT NOT NULL,
  source TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  interest TEXT NOT NULL DEFAULT 'price_unlocked' CHECK (interest IN ('price_unlocked', 'checkout_intent')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_visits_locale_surface_time
  ON public.marketing_page_visits (locale, surface, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_visits_visitor_time
  ON public.marketing_page_visits (visitor_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_leads_locale_time
  ON public.marketing_leads (locale, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_leads_email
  ON public.marketing_leads (lower(email));

ALTER TABLE public.marketing_page_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_page_visits_no_client_access ON public.marketing_page_visits;
CREATE POLICY marketing_page_visits_no_client_access
  ON public.marketing_page_visits
  FOR ALL
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS marketing_leads_no_client_access ON public.marketing_leads;
CREATE POLICY marketing_leads_no_client_access
  ON public.marketing_leads
  FOR ALL
  USING (false)
  WITH CHECK (false);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_page_visits TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_leads TO service_role;

NOTIFY pgrst, 'reload schema';
