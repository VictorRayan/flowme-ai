-- 052_billing_notification_update_policy.sql
-- Allows users to dismiss their own billing notifications.

DROP POLICY IF EXISTS billing_notifications_owner_update ON public.billing_notifications;
CREATE POLICY billing_notifications_owner_update
  ON public.billing_notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('pending', 'dismissed')
  );

NOTIFY pgrst, 'reload schema';
