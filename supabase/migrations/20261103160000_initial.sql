CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE private.staff_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id), display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','coordinator','backoffice','accommodation','driver','accountant','quality')),
  active boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE private.travel_groups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE private.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES private.travel_groups(id),
  first_name text NOT NULL, last_name text NOT NULL, coordinator_id uuid NOT NULL REFERENCES private.staff_profiles(id),
  arrival timestamptz NOT NULL, departure timestamptz NOT NULL, availability text NOT NULL DEFAULT '',
  transfer_option text NOT NULL CHECK (transfer_option IN ('none','arrival','departure','round_trip')), transfer_free boolean NOT NULL,
  version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (departure > arrival)
);
CREATE INDEX visits_arrival_idx ON private.visits(arrival);
CREATE INDEX visits_coordinator_idx ON private.visits(coordinator_id, arrival);
CREATE INDEX visits_group_idx ON private.visits(group_id);
CREATE TABLE private.treatments (visit_id uuid PRIMARY KEY REFERENCES private.visits(id), description text NOT NULL);
CREATE TABLE private.companions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), primary_visit_id uuid NOT NULL UNIQUE REFERENCES private.visits(id), first_name text NOT NULL, last_name text NOT NULL, treatment_visit_id uuid REFERENCES private.visits(id));
CREATE TABLE private.backoffice_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), visit_id uuid NOT NULL UNIQUE REFERENCES private.visits(id),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','completed')),
  owner_id uuid REFERENCES private.staff_profiles(id), started_at timestamptz, completed_at timestamptz, version integer NOT NULL DEFAULT 1
);
CREATE TABLE private.accommodation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), visit_id uuid NOT NULL UNIQUE REFERENCES private.visits(id),
  apartment_type text NOT NULL CHECK (apartment_type IN ('studio','one_bed_sofa','two_bed','two_bed_living')),
  is_free boolean NOT NULL, free_nights integer NOT NULL DEFAULT 0 CHECK (free_nights BETWEEN 0 AND 365),
  status text NOT NULL DEFAULT 'unprocessed' CHECK (status IN ('unprocessed','reserved')),
  reservation_reference text, address text, reserved_by uuid REFERENCES private.staff_profiles(id), reserved_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  CHECK (is_free OR free_nights=0), CHECK (status<>'reserved' OR (length(reservation_reference)>0 AND length(address)>0))
);
CREATE TABLE private.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid NOT NULL REFERENCES private.travel_groups(id),
  direction text NOT NULL CHECK (direction IN ('arrival','departure')), scheduled_at timestamptz NOT NULL,
  is_free boolean NOT NULL, version integer NOT NULL DEFAULT 1,
  UNIQUE (group_id, direction, scheduled_at, is_free)
);
CREATE INDEX transfers_schedule_idx ON private.transfers(scheduled_at);
CREATE TABLE private.transfer_passengers (
  transfer_id uuid NOT NULL REFERENCES private.transfers(id) ON DELETE CASCADE,
  visit_id uuid NOT NULL REFERENCES private.visits(id), PRIMARY KEY (transfer_id, visit_id)
);
CREATE TABLE private.idempotency_keys (
  actor_id uuid NOT NULL REFERENCES private.staff_profiles(id), key uuid NOT NULL, payload_hash text NOT NULL,
  visit_id uuid REFERENCES private.visits(id), PRIMARY KEY(actor_id,key)
);
CREATE TABLE private.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL REFERENCES private.staff_profiles(id),
  action text NOT NULL, resource_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipient_id uuid NOT NULL REFERENCES private.staff_profiles(id),
  event_type text NOT NULL, resource_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_recipient_idx ON public.notifications(recipient_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications FROM anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;
CREATE POLICY notifications_recipient_select ON public.notifications FOR SELECT TO authenticated USING ((SELECT auth.uid())=recipient_id);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
