-- 051_subscription_provider_customer_index.sql
-- Supports Stripe customer reuse before a subscription id exists.

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_provider_customer
  ON public.user_subscriptions (billing_provider, provider_customer_id)
  WHERE provider_customer_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
