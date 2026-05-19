-- Remove the legacy local task/event store.
-- All user-scheduled work must now be represented as Google Calendar events.

DROP TABLE IF EXISTS public.microactivities CASCADE;
