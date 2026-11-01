#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
container_name="flowme-security-$$"
trap 'docker rm -f "$container_name" >/dev/null 2>&1 || true' EXIT

docker run --rm -d --name "$container_name" -e POSTGRES_PASSWORD=local-test-only postgres:16-alpine >/dev/null
for attempt in {1..30}; do
  if docker exec "$container_name" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done

docker exec -i "$container_name" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
INSERT INTO auth.users VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT current_setting('request.jwt.claim.role', true)
$$;
CREATE TABLE public.notes (id uuid PRIMARY KEY, user_id uuid NOT NULL);
CREATE TABLE public.people (id uuid PRIMARY KEY, user_id uuid NOT NULL);
CREATE TABLE public.documents (id uuid PRIMARY KEY, user_id uuid NOT NULL);
CREATE TABLE public.action_plans (id uuid PRIMARY KEY, user_id uuid NOT NULL);
CREATE TABLE public.smart_goals (id uuid PRIMARY KEY, user_id uuid NOT NULL);
CREATE TABLE public.note_mentions (note_id uuid NOT NULL, person_id uuid NOT NULL);
CREATE TABLE public.document_links (note_id uuid NOT NULL, document_id uuid NOT NULL);
CREATE TABLE public.action_plan_goal_links (user_id uuid NOT NULL, action_plan_id uuid NOT NULL, goal_id uuid NOT NULL);
CREATE TABLE public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider text NOT NULL, event_id text NOT NULL,
  event_type text NOT NULL, payload jsonb NOT NULL, user_id uuid,
  provider_customer_id text, provider_subscription_id text,
  processing_started_at timestamptz, processed_at timestamptz,
  UNIQUE (provider, event_id)
);
GRANT USAGE ON SCHEMA public, auth TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes, public.people, public.documents,
  public.action_plans, public.smart_goals, public.note_mentions, public.document_links,
  public.action_plan_goal_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_events TO service_role;
GRANT SELECT ON public.notes TO anon;
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['notes','people','documents','action_plans','smart_goals'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY owner ON public.%I FOR ALL TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()))', table_name);
  END LOOP;
END $$;
ALTER TABLE public.note_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_plan_goal_links ENABLE ROW LEVEL SECURITY;
INSERT INTO public.notes VALUES ('10000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('10000000-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
INSERT INTO public.people VALUES ('20000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('20000000-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
INSERT INTO public.documents VALUES ('30000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('30000000-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
INSERT INTO public.action_plans VALUES ('40000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('40000000-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
INSERT INTO public.smart_goals VALUES ('50000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('50000000-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
SQL

docker exec -i "$container_name" psql -U postgres -v ON_ERROR_STOP=1 -q < "$repo_root/supabase/migrations/067_document_link_tenant_guard.sql"
docker exec -i "$container_name" psql -U postgres -v ON_ERROR_STOP=1 -q < "$repo_root/supabase/migrations/066_atomic_billing_event_claim.sql"
docker exec -i "$container_name" psql -U postgres -v ON_ERROR_STOP=1 -q < "$repo_root/supabase/migrations/068_inbound_message_claims.sql"
docker exec -i "$container_name" psql -U postgres -v ON_ERROR_STOP=1 -q < "$repo_root/supabase/migrations/069_outbound_message_idempotency.sql"

docker exec -i "$container_name" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.notes) <> 1 THEN RAISE EXCEPTION 'notes RLS leak'; END IF;
  INSERT INTO public.note_mentions VALUES ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');
  INSERT INTO public.document_links VALUES ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001');
  INSERT INTO public.action_plan_goal_links VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001');
  BEGIN
    INSERT INTO public.note_mentions VALUES ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002');
    RAISE EXCEPTION 'cross-user person link accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.document_links VALUES ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002');
    RAISE EXCEPTION 'cross-user document link accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.action_plan_goal_links VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002');
    RAISE EXCEPTION 'cross-user goal link accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.notes) <> 1 THEN RAISE EXCEPTION 'user B can read user A notes'; END IF;
  IF (SELECT count(*) FROM public.note_mentions) <> 0 THEN RAISE EXCEPTION 'user B can read user A mentions'; END IF;
  IF (SELECT count(*) FROM public.document_links) <> 0 THEN RAISE EXCEPTION 'user B can read user A document links'; END IF;
  IF (SELECT count(*) FROM public.action_plan_goal_links) <> 0 THEN RAISE EXCEPTION 'user B can read user A goal links'; END IF;
END $$;
RESET ROLE;
SET ROLE anon;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.notes) <> 0 THEN RAISE EXCEPTION 'anon notes leak'; END IF;
END $$;
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
DO $$
BEGIN
  BEGIN
    PERFORM public.claim_billing_event('stripe','forbidden','invoice.paid','{}');
    RAISE EXCEPTION 'authenticated user claimed billing event';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', false);
DO $$
BEGIN
  IF public.claim_inbound_message('evolution','sender-a','msg-1') <> 'claimed' THEN RAISE EXCEPTION 'inbound first claim failed'; END IF;
  IF public.claim_inbound_message('evolution','sender-a','msg-1') <> 'in_progress' THEN RAISE EXCEPTION 'inbound concurrent claim accepted'; END IF;
  UPDATE public.inbound_message_events SET processed_at = NOW() WHERE source = 'evolution' AND sender_id = 'sender-a' AND message_id = 'msg-1';
  IF public.claim_inbound_message('evolution','sender-a','msg-1') <> 'processed' THEN RAISE EXCEPTION 'inbound processed duplicate accepted'; END IF;
  IF public.claim_outbound_message('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','request-1','slack',repeat('a',64))->>'status' <> 'claimed' THEN RAISE EXCEPTION 'outbound first claim failed'; END IF;
  IF public.claim_outbound_message('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','request-1','slack',repeat('a',64))->>'status' <> 'in_progress' THEN RAISE EXCEPTION 'outbound duplicate claim accepted'; END IF;
  UPDATE public.outbound_message_events SET completed_at = NOW(), receipt = '{"ts":"1.0"}'::jsonb WHERE request_id = 'request-1';
  IF public.claim_outbound_message('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','request-1','slack',repeat('a',64))->>'status' <> 'completed' THEN RAISE EXCEPTION 'outbound completed duplicate failed'; END IF;
  IF NOT public.claim_billing_event('stripe','evt-1','invoice.paid','{}') THEN RAISE EXCEPTION 'first billing claim failed'; END IF;
  IF public.claim_billing_event('stripe','evt-1','invoice.paid','{}') THEN RAISE EXCEPTION 'duplicate billing claim accepted'; END IF;
  UPDATE public.billing_events SET processed_at = now() WHERE provider = 'stripe' AND event_id = 'evt-1';
  IF public.claim_billing_event('stripe','evt-1','invoice.paid','{}') THEN RAISE EXCEPTION 'processed billing claim accepted'; END IF;
  INSERT INTO public.billing_events (provider,event_id,event_type,payload,processing_started_at)
    VALUES ('stripe','evt-stale','invoice.paid','{}',now() - interval '6 minutes');
  IF NOT public.claim_billing_event('stripe','evt-stale','invoice.paid','{}') THEN RAISE EXCEPTION 'stale claim was not recovered'; END IF;
END $$;
RESET ROLE;
SQL

claim_dir="$(mktemp -d)"
trap 'rm -rf "$claim_dir"; docker rm -f "$container_name" >/dev/null 2>&1 || true' EXIT
for attempt in {1..8}; do
  docker exec "$container_name" psql -U postgres -At -v ON_ERROR_STOP=1 \
    -c "SET ROLE service_role; SET request.jwt.claim.role = 'service_role'; SELECT public.claim_billing_event('stripe','evt-concurrent','invoice.paid','{}');" \
    > "$claim_dir/$attempt" &
done
wait
true_claims="$(grep -hxc t "$claim_dir"/* | awk '{sum += $1} END {print sum+0}')"
if [ "$true_claims" -ne 1 ]; then
  echo "Expected one concurrent billing claimant, got $true_claims" >&2
  exit 1
fi

echo 'Local PostgreSQL RLS and billing claim checks passed.'
