-- 055_subscription_provider_customer_full_unique_index.sql
-- PostgREST upsert ON CONFLICT needs a non-partial unique index for provider customer reuse.

DROP INDEX IF EXISTS public.idx_user_subscriptions_provider_customer;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_provider_customer
  ON public.user_subscriptions (billing_provider, provider_customer_id);

NOTIFY pgrst, 'reload schema';
