-- 054_billing_service_role_grants.sql
-- Keeps billing tables server-only while making them visible to PostgREST service-role requests.

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT ON public.subscription_plans TO service_role;
GRANT SELECT ON public.subscription_prices TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_entitlements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_notifications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_cancellation_requests TO service_role;

NOTIFY pgrst, 'reload schema';
