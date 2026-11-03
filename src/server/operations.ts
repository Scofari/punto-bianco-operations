import { database, transaction } from './db';
import { AppError, nextTaskStatus, requireRole, type Staff } from '@/lib/domain';
import { notify } from './visits';

export async function listAccommodations(actor: Staff, page: number) {
  requireRole(actor, ['admin', 'accommodation', 'accountant', 'quality']);
  const columns =
    actor.role === 'accountant'
      ? 'a.id,a.visit_id,a.apartment_type,a.is_free,a.free_nights,a.status,a.version,NULL::text AS reservation_reference,NULL::text AS address'
      : 'a.*';
  const r = await database().query(
    `SELECT ${columns},v.first_name,v.last_name,v.arrival,v.departure,s.display_name AS coordinator_name,count(*) OVER()::int AS total_count
    FROM private.accommodation_requests a JOIN private.visits v ON v.id=a.visit_id JOIN private.staff_profiles s ON s.id=v.coordinator_id
    ORDER BY (a.status='unprocessed') DESC,v.arrival,a.id LIMIT 25 OFFSET $1`,
    [(page - 1) * 25],
  );
  return { items: r.rows, page, total: r.rows[0]?.total_count ?? 0 };
}
export async function transitionTask(actor: Staff, id: string, status: string, version: number) {
  requireRole(actor, ['admin', 'backoffice']);
  return transaction(async (db) => {
    const {
      rows: [task],
    } = await db.query('SELECT * FROM private.backoffice_tasks WHERE id=$1 FOR UPDATE', [id]);
    if (!task) throw new AppError(404, 'Cazul nu a fost găsit.');
    if (task.version !== version)
      throw new AppError(409, 'Cazul a fost preluat sau modificat de un coleg.');
    if (!nextTaskStatus(task.status, status))
      throw new AppError(422, 'Tranziția de stare nu este permisă.');
    if (task.owner_id && task.owner_id !== actor.id && actor.role !== 'admin')
      throw new AppError(403, 'Cazul a fost preluat de alt coleg.');
    const r = await db.query(
      `UPDATE private.backoffice_tasks SET status=$2,owner_id=COALESCE(owner_id,$3),started_at=COALESCE(started_at,now()),completed_at=CASE WHEN $2='completed' THEN now() ELSE NULL END,version=version+1 WHERE id=$1 RETURNING id,version,status`,
      [id, status, actor.id],
    );
    await db.query(
      'INSERT INTO public.notifications(recipient_id,event_type,resource_id) SELECT coordinator_id,$2,id FROM private.visits WHERE id=$1',
      [task.visit_id, 'backoffice_updated'],
    );
    return r.rows[0];
  });
}
export async function reserveAccommodation(
  actor: Staff,
  id: string,
  reference: string,
  address: string,
  version: number,
) {
  requireRole(actor, ['admin', 'accommodation']);
  return transaction(async (db) => {
    const r = await db.query(
      `UPDATE private.accommodation_requests SET status='reserved',reservation_reference=$2,address=$3,reserved_by=$4,reserved_at=now(),version=version+1 WHERE id=$1 AND version=$5 RETURNING id,visit_id,version`,
      [id, reference, address, actor.id, version],
    );
    if (!r.rowCount) throw new AppError(409, 'Cererea a fost modificată. Reîncărcați lista.');
    await db.query(
      'INSERT INTO public.notifications(recipient_id,event_type,resource_id) SELECT coordinator_id,$2,id FROM private.visits WHERE id=$1',
      [r.rows[0].visit_id, 'accommodation_reserved'],
    );
    await notify(db, ['admin'], 'accommodation_reserved', r.rows[0].visit_id);
    return r.rows[0];
  });
}
export async function listTransfers(actor: Staff, from: string, to: string) {
  requireRole(actor, ['admin', 'coordinator', 'driver', 'accountant', 'quality']);
  const r = await database().query(
    `SELECT t.id,t.direction,t.scheduled_at,t.is_free,
    string_agg(DISTINCT v.first_name || ' ' || v.last_name, ', ' ORDER BY v.first_name || ' ' || v.last_name) AS passengers,
    string_agg(DISTINCT CASE WHEN c.treatment_visit_id IS NULL THEN c.first_name || ' ' || c.last_name END, ', ') AS companions,
    count(DISTINCT v.id)::int AS passenger_count
    FROM private.transfers t JOIN private.transfer_passengers p ON p.transfer_id=t.id JOIN private.visits v ON v.id=p.visit_id
    LEFT JOIN private.companions c ON c.primary_visit_id=v.id
    WHERE t.scheduled_at >= $1 AND t.scheduled_at < $2 AND ($3::uuid IS NULL OR EXISTS (SELECT 1 FROM private.transfer_passengers p2 JOIN private.visits v2 ON v2.id=p2.visit_id WHERE p2.transfer_id=t.id AND v2.coordinator_id=$3))
    GROUP BY t.id ORDER BY t.scheduled_at,t.id LIMIT 500`,
    [from, to, actor.role === 'coordinator' ? actor.id : null],
  );
  return { items: r.rows };
}
export async function listStaff(actor: Staff) {
  requireRole(actor, ['admin', 'coordinator']);
  const r = await database().query(
    `SELECT id,display_name,role,active,version FROM private.staff_profiles WHERE ${actor.role === 'admin' ? 'true' : "active AND role IN ('admin','coordinator')"} ORDER BY display_name`,
  );
  return { items: r.rows };
}
