CREATE INDEX IF NOT EXISTS accommodation_reserved_by_idx ON private.accommodation_requests(reserved_by);
CREATE INDEX IF NOT EXISTS audit_actor_idx ON private.audit_events(actor_id);
CREATE INDEX IF NOT EXISTS backoffice_owner_idx ON private.backoffice_tasks(owner_id);
CREATE INDEX IF NOT EXISTS companions_treatment_visit_idx ON private.companions(treatment_visit_id);
CREATE INDEX IF NOT EXISTS idempotency_visit_idx ON private.idempotency_keys(visit_id);
CREATE INDEX IF NOT EXISTS transfer_passengers_visit_idx ON private.transfer_passengers(visit_id);
