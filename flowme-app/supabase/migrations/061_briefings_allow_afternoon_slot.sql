-- 061_briefings_allow_afternoon_slot.sql
-- The app now composes morning, afternoon, and evening briefings. Older
-- environments still have the original check constraint with only morning/evening.

ALTER TABLE public.briefings
  DROP CONSTRAINT IF EXISTS briefings_slot_check;

ALTER TABLE public.briefings
  ADD CONSTRAINT briefings_slot_check
  CHECK (slot IN ('morning', 'afternoon', 'evening'));

NOTIFY pgrst, 'reload schema';
