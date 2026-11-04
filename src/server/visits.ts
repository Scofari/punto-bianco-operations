import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { database, transaction } from './db';
import {
  AppError,
  canManageVisit,
  requireRole,
  transferDirections,
  type Staff,
  type PersonInput,
  type VisitInput,
} from '@/lib/domain';

export async function notify(db: PoolClient, roles: string[], event: string, resource: string) {
  await db.query(
    'INSERT INTO public.notifications(recipient_id,event_type,resource_id) SELECT id,$2,$3 FROM private.staff_profiles WHERE active AND role=ANY($1::text[])',
    [roles, event, resource],
  );
}
async function checkCoordinator(db: PoolClient, actor: Staff, id: string) {
  if (actor.role === 'coordinator' && actor.id !== id)
    throw new AppError(403, 'Puteți atribui doar propriile vizite.');
  const r = await db.query(
    "SELECT id FROM private.staff_profiles WHERE id=$1 AND active AND role IN ('admin','coordinator')",
    [id],
  );
  if (!r.rowCount) throw new AppError(422, 'Coordonatorul selectat nu este disponibil.');
}
async function createPerson(db: PoolClient, actor: Staff, groupId: string, p: PersonInput) {
  await checkCoordinator(db, actor, p.coordinatorId);
  const {
    rows: [visit],
  } = await db.query(
    `INSERT INTO private.visits(group_id,first_name,last_name,coordinator_id,arrival,departure,availability,transfer_option,transfer_free)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [
      groupId,
      p.firstName,
      p.lastName,
      p.coordinatorId,
      p.arrival,
      p.departure,
      p.availability,
      p.transfer,
      p.transferFree,
    ],
  );
  await db.query('INSERT INTO private.treatments(visit_id,description) VALUES($1,$2)', [
    visit.id,
    p.treatment,
  ]);
  await db.query('INSERT INTO private.backoffice_tasks(visit_id) VALUES($1)', [visit.id]);
  await db.query(
    'INSERT INTO private.accommodation_requests(visit_id,apartment_type,is_free,free_nights) VALUES($1,$2,$3,$4)',
    [visit.id, p.apartmentType, p.accommodationFree, p.freeNights],
  );
  await notify(db, ['backoffice', 'accommodation', 'admin'], 'visit_created', visit.id);
  return visit.id as string;
}
async function rebuildTransfers(db: PoolClient, groupId: string) {
  // Group-level lock serializes edits across primary/companion visits.
  await db.query('SELECT id FROM private.travel_groups WHERE id=$1 FOR UPDATE', [groupId]);
  await db.query('DELETE FROM private.transfers WHERE group_id=$1', [groupId]);
  const visits = await db.query(
    'SELECT id,arrival,departure,transfer_option,transfer_free FROM private.visits WHERE group_id=$1 ORDER BY id',
    [groupId],
  );
  for (const v of visits.rows) {
    for (const direction of transferDirections(v.transfer_option)) {
      const time = direction === 'arrival' ? v.arrival : v.departure;
      const {
        rows: [transfer],
      } = await db.query(
        `INSERT INTO private.transfers(group_id,direction,scheduled_at,is_free) VALUES($1,$2,$3,$4)
        ON CONFLICT(group_id,direction,scheduled_at,is_free) DO UPDATE SET version=private.transfers.version+1 RETURNING id`,
        [groupId, direction, time, v.transfer_free],
      );
      await db.query(
        'INSERT INTO private.transfer_passengers(transfer_id,visit_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [transfer.id, v.id],
      );
    }
  }
}
export async function createVisit(actor: Staff, input: VisitInput, key: string) {
  requireRole(actor, ['admin', 'coordinator']);
  const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return transaction(async (db) => {
    await db.query(
      'INSERT INTO private.idempotency_keys(actor_id,key,payload_hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [actor.id, key, hash],
    );
    const {
      rows: [existing],
    } = await db.query(
      'SELECT visit_id,payload_hash FROM private.idempotency_keys WHERE actor_id=$1 AND key=$2 FOR UPDATE',
      [actor.id, key],
    );
    if (existing.payload_hash !== hash)
      throw new AppError(409, 'Cheia de înregistrare a fost utilizată pentru alte date.');
    if (existing.visit_id) return { id: existing.visit_id, replayed: true };
    const {
      rows: [group],
    } = await db.query('INSERT INTO private.travel_groups DEFAULT VALUES RETURNING id');
    const id = await createPerson(db, actor, group.id, input.patient);
    if (input.companion) {
      const c = input.companion;
      const linked = c.hasTreatment ? await createPerson(db, actor, group.id, c.patient) : null;
      await db.query(
        'INSERT INTO private.companions(primary_visit_id,first_name,last_name,treatment_visit_id) VALUES($1,$2,$3,$4)',
        [
          id,
          c.hasTreatment ? c.patient.firstName : c.firstName,
          c.hasTreatment ? c.patient.lastName : c.lastName,
          linked,
        ],
      );
    }
    await rebuildTransfers(db, group.id);
    await notify(db, ['driver'], 'transfer_updated', id);
    await db.query('UPDATE private.idempotency_keys SET visit_id=$3 WHERE actor_id=$1 AND key=$2', [
      actor.id,
      key,
      id,
    ]);
    await db.query(
      'INSERT INTO private.audit_events(actor_id,action,resource_id) VALUES($1,$2,$3)',
      [actor.id, 'visit_created', id],
    );
    return { id, replayed: false };
  });
}
export async function updateVisit(actor: Staff, id: string, p: PersonInput, version: number) {
  requireRole(actor, ['admin', 'coordinator']);
  return transaction(async (db) => {
    const initial = await db.query('SELECT group_id FROM private.visits WHERE id=$1', [id]);
    if (!initial.rowCount) throw new AppError(404, 'Vizita nu a fost găsită.');
    await db.query('SELECT id FROM private.travel_groups WHERE id=$1 FOR UPDATE', [
      initial.rows[0].group_id,
    ]);
    const {
      rows: [v],
    } = await db.query('SELECT * FROM private.visits WHERE id=$1 FOR UPDATE', [id]);
    if (!canManageVisit(actor, v.coordinator_id))
      throw new AppError(403, 'Vizita aparține altui coordonator.');
    if (v.version !== version)
      throw new AppError(409, 'Datele au fost modificate. Reîncărcați vizita.');
    await checkCoordinator(db, actor, p.coordinatorId);
    const {
      rows: [a],
    } = await db.query(
      'SELECT * FROM private.accommodation_requests WHERE visit_id=$1 FOR UPDATE',
      [id],
    );
    const lodgingChanged =
      a.apartment_type !== p.apartmentType ||
      a.is_free !== p.accommodationFree ||
      a.free_nights !== p.freeNights ||
      new Date(v.arrival).toISOString() !== new Date(p.arrival).toISOString() ||
      new Date(v.departure).toISOString() !== new Date(p.departure).toISOString();
    await db.query(
      `UPDATE private.visits SET first_name=$2,last_name=$3,coordinator_id=$4,arrival=$5,departure=$6,availability=$7,transfer_option=$8,transfer_free=$9,version=version+1,updated_at=now() WHERE id=$1`,
      [
        id,
        p.firstName,
        p.lastName,
        p.coordinatorId,
        p.arrival,
        p.departure,
        p.availability,
        p.transfer,
        p.transferFree,
      ],
    );
    await db.query('UPDATE private.treatments SET description=$2 WHERE visit_id=$1', [
      id,
      p.treatment,
    ]);
    await db.query(
      `UPDATE private.accommodation_requests SET apartment_type=$2,is_free=$3,free_nights=$4,
      status=CASE WHEN $5 THEN 'unprocessed' ELSE status END,
      reservation_reference=CASE WHEN $5 THEN NULL ELSE reservation_reference END,
      address=CASE WHEN $5 THEN NULL ELSE address END,
      reserved_by=CASE WHEN $5 THEN NULL ELSE reserved_by END,
      reserved_at=CASE WHEN $5 THEN NULL ELSE reserved_at END, version=version+1 WHERE visit_id=$1`,
      [id, p.apartmentType, p.accommodationFree, p.freeNights, lodgingChanged],
    );
    await rebuildTransfers(db, v.group_id);
    await notify(db, ['backoffice', 'accommodation', 'driver', 'admin'], 'visit_updated', id);
    await db.query(
      'INSERT INTO private.audit_events(actor_id,action,resource_id) VALUES($1,$2,$3)',
      [actor.id, 'visit_updated', id],
    );
    return { id, lodgingReset: lodgingChanged && a.status === 'reserved' };
  });
}
export async function listVisits(
  actor: Staff,
  search: string,
  page: number,
  id?: string,
  status = 'all',
) {
  requireRole(actor, ['admin', 'coordinator', 'backoffice', 'quality']);
  const values: unknown[] = [
    actor.role === 'coordinator' ? actor.id : null,
    `%${search}%`,
    id ?? null,
    status,
    id ? 0 : (page - 1) * 25,
  ];
  const result = await database().query(
    `WITH matching AS (SELECT v.*,s.display_name AS coordinator_name,t.description AS treatment,
    b.id AS task_id,b.status AS task_status,b.version AS task_version,a.id AS accommodation_id,a.apartment_type,a.is_free AS accommodation_free,a.free_nights,a.status AS accommodation_status,a.reservation_reference,a.address,
    COALESCE(cv.first_name,c.first_name) AS companion_first_name,COALESCE(cv.last_name,c.last_name) AS companion_last_name,c.treatment_visit_id AS companion_visit_id
    FROM private.visits v JOIN private.staff_profiles s ON s.id=v.coordinator_id JOIN private.treatments t ON t.visit_id=v.id
    JOIN private.backoffice_tasks b ON b.visit_id=v.id JOIN private.accommodation_requests a ON a.visit_id=v.id
    LEFT JOIN private.companions c ON c.primary_visit_id=v.id
    LEFT JOIN private.visits cv ON cv.id=c.treatment_visit_id
    WHERE ($1::uuid IS NULL OR v.coordinator_id=$1) AND (v.first_name || ' ' || v.last_name ILIKE $2) AND ($3::uuid IS NULL OR v.id=$3)
    AND ($4='all' OR b.status=$4))
    SELECT (SELECT count(*)::int FROM matching) AS total,
    COALESCE((SELECT json_agg(records) FROM (SELECT * FROM matching ORDER BY arrival,id LIMIT 25 OFFSET $5) records),'[]'::json) AS items`,
    values,
  );
  return { ...result.rows[0], page: id ? 1 : page };
}
