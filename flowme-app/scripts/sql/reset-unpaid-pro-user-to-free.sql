-- One-off production operation: revoke manually granted Pro access so the user
-- must complete a real checkout. Run in the Supabase SQL editor after reviewing
-- the preview queries. This script aborts if any provider subscription identity
-- exists, preventing an external Stripe/Asaas/Apple/Google subscription orphan.

BEGIN;

DO $$
DECLARE
  target_user_id UUID;
  external_subscription_count INTEGER;
BEGIN
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE lower(email) = lower('victorrayansouzaramos@gmail.com')
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user was not found';
  END IF;

  SELECT COUNT(*) INTO external_subscription_count
  FROM public.user_subscriptions
  WHERE user_id = target_user_id
    AND plan_code = 'pro'
    AND status IN ('trialing', 'active', 'past_due', 'grace_period', 'account_hold', 'incomplete')
    AND (
      provider_subscription_id IS NOT NULL
      OR provider_original_transaction_id IS NOT NULL
      OR provider_purchase_token IS NOT NULL
    );

  IF external_subscription_count > 0 THEN
    RAISE EXCEPTION 'Refusing local revoke: % active Pro row(s) have an external provider identity. Cancel or reconcile the provider first.', external_subscription_count;
  END IF;

  UPDATE public.user_subscriptions
  SET
    plan_code = 'free',
    status = 'free',
    current_period_start = NULL,
    current_period_end = NULL,
    cancel_at_period_end = false,
    grace_period_ends_at = NULL,
    last_payment_failure_at = NULL,
    updated_at = NOW(),
    last_synced_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'manual_pro_revoked_at', NOW(),
      'manual_pro_revoke_reason', 'require_real_checkout'
    )
  WHERE user_id = target_user_id
    AND plan_code = 'pro'
    AND status IN ('free', 'trialing', 'active', 'past_due', 'grace_period', 'account_hold', 'incomplete');

  INSERT INTO public.user_entitlements (
    user_id, plan_code, has_pro, billing_state, access_until, features, ai_credits, updated_at
  ) VALUES (
    target_user_id,
    'free',
    false,
    'free',
    NULL,
    '{
      "notes": true,
      "balys_limited": true,
      "balys_unlimited": false,
      "calendar": false,
      "today": false,
      "goals": false,
      "finance": false,
      "reviews": false,
      "connectors": false,
      "whatsapp": false,
      "briefings": false,
      "reminders": false,
      "meetings": false,
      "images": false,
      "support": true
    }'::jsonb,
    '{"unlimited": false, "daily_limit": 5, "label": "5 créditos de IA por dia"}'::jsonb,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_code = EXCLUDED.plan_code,
    has_pro = EXCLUDED.has_pro,
    billing_state = EXCLUDED.billing_state,
    access_until = EXCLUDED.access_until,
    features = EXCLUDED.features,
    ai_credits = EXCLUDED.ai_credits,
    updated_at = EXCLUDED.updated_at;

  RAISE NOTICE 'Manual Pro access revoked for user %', target_user_id;
END;
$$;

COMMIT;

SELECT
  users.email,
  subscriptions.plan_code,
  subscriptions.status,
  subscriptions.billing_provider,
  subscriptions.provider_subscription_id,
  entitlements.has_pro,
  entitlements.billing_state
FROM auth.users users
LEFT JOIN public.user_subscriptions subscriptions ON subscriptions.user_id = users.id
LEFT JOIN public.user_entitlements entitlements ON entitlements.user_id = users.id
WHERE lower(users.email) = lower('victorrayansouzaramos@gmail.com')
ORDER BY subscriptions.updated_at DESC NULLS LAST;
