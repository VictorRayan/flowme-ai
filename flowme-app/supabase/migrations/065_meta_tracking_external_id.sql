-- 065_meta_tracking_external_id.sql
-- Stores the Meta external_id used for CAPI/browser advanced matching.

ALTER TABLE public.marketing_page_visits
  ADD COLUMN IF NOT EXISTS meta_external_id TEXT;

ALTER TABLE public.marketing_leads
  ADD COLUMN IF NOT EXISTS meta_external_id TEXT;

ALTER TABLE public.public_checkout_sessions
  ADD COLUMN IF NOT EXISTS meta_external_id TEXT;

UPDATE public.marketing_page_visits
SET meta_external_id = visitor_id
WHERE meta_external_id IS NULL
  AND visitor_id IS NOT NULL;

UPDATE public.marketing_leads
SET meta_external_id = visitor_id
WHERE meta_external_id IS NULL
  AND visitor_id IS NOT NULL;

UPDATE public.public_checkout_sessions pcs
SET meta_external_id = ml.meta_external_id
FROM public.marketing_leads ml
WHERE pcs.lead_id = ml.id
  AND pcs.meta_external_id IS NULL
  AND ml.meta_external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_visits_meta_external_time
  ON public.marketing_page_visits (meta_external_id, occurred_at DESC)
  WHERE meta_external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_leads_meta_external_time
  ON public.marketing_leads (meta_external_id, created_at DESC)
  WHERE meta_external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_public_checkout_sessions_meta_external_created
  ON public.public_checkout_sessions (meta_external_id, created_at DESC)
  WHERE meta_external_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
