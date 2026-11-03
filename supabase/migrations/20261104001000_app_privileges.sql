-- Run as project administrator after creating the punto_app LOGIN with a secret supplied outside version control.
GRANT CONNECT ON DATABASE postgres TO punto_app;
GRANT USAGE ON SCHEMA private,public TO punto_app;
GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA private TO punto_app;
GRANT UPDATE ON private.staff_profiles,private.visits,private.treatments,private.backoffice_tasks,
  private.accommodation_requests,private.transfers,private.idempotency_keys TO punto_app;
GRANT DELETE ON private.transfers TO punto_app;
-- SELECT FOR UPDATE requires an UPDATE privilege on the locked relation.
GRANT UPDATE(id) ON private.travel_groups TO punto_app;
GRANT SELECT,INSERT ON public.notifications TO punto_app;
DROP POLICY IF EXISTS notifications_backend ON public.notifications;
CREATE POLICY notifications_backend ON public.notifications FOR ALL TO punto_app USING(true) WITH CHECK(true);
