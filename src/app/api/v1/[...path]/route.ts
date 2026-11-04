import { z } from 'zod';
import { currentStaff, assertOrigin } from '@/server/auth';
import { database, transaction } from '@/server/db';
import { createVisit, listVisits, updateVisit } from '@/server/visits';
import {
  listAccommodations,
  listStaff,
  listTransfers,
  reserveAccommodation,
  transitionTask,
} from '@/server/operations';
import { AppError, personSchema, requireRole, roles, visitSchema } from '@/lib/domain';
import { fail, ok } from '@/server/http';
export const runtime = 'nodejs';
type Context = { params: Promise<{ path: string[] }> };
const versionSchema = z.number().int().positive();
async function route(request: Request, context: Context) {
  try {
    const { path } = await context.params;
    if (request.method !== 'GET') await assertOrigin();
    const actor = await currentStaff();
    const [resource, id] = path;
    if (path.length > 2) throw new AppError(404, 'Ruta nu există.');
    const url = new URL(request.url);
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .parse(url.searchParams.get('page') ?? 1);
    if (request.method === 'GET') {
      const search = z
        .string()
        .max(100)
        .parse(url.searchParams.get('search') ?? '');
      if (resource === 'me' && !id) return ok({ staff: actor });
      if (resource === 'staff' && !id) return ok(await listStaff(actor));
      if (resource === 'visits' || resource === 'backoffice') {
        if (id) z.uuid().parse(id);
        if (resource === 'backoffice') requireRole(actor, ['admin', 'backoffice', 'quality']);
        const result = await listVisits(
          actor,
          search,
          page,
          id,
          z
            .enum(['all', 'new', 'in_progress', 'completed'])
            .parse(url.searchParams.get('status') ?? 'all'),
        );
        if (id && !result.items.length) throw new AppError(404, 'Vizita nu a fost găsită.');
        return ok(result);
      }
      if (resource === 'accommodations' && !id)
        return ok(
          await listAccommodations(
            actor,
            page,
            search,
            z
              .enum(['all', 'unprocessed', 'reserved'])
              .parse(url.searchParams.get('status') ?? 'all'),
          ),
        );
      if (resource === 'transfers' && !id) {
        const from = z.iso.datetime({ offset: true }).parse(url.searchParams.get('from'));
        const to = z.iso.datetime({ offset: true }).parse(url.searchParams.get('to'));
        if (Date.parse(to) <= Date.parse(from) || Date.parse(to) - Date.parse(from) > 32 * 86400000)
          throw new AppError(422, 'Selectați maximum 31 de zile.');
        return ok(await listTransfers(actor, from, to));
      }
      if (resource === 'notifications' && !id)
        return ok({
          items: (
            await database().query(
              'SELECT id,event_type,resource_id,created_at FROM public.notifications WHERE recipient_id=$1 ORDER BY created_at DESC,id DESC LIMIT 30',
              [actor.id],
            )
          ).rows,
        });
    }
    if (request.method === 'POST' && resource === 'visits' && !id) {
      const key = z.uuid().parse(request.headers.get('idempotency-key'));
      const result = await createVisit(actor, visitSchema.parse(await request.json()), key);
      return ok(result, result.replayed ? 200 : 201);
    }
    if (request.method === 'PATCH' && id) {
      z.uuid().parse(id);
      const body = await request.json();
      if (resource === 'visits') {
        const input = z.object({ patient: personSchema, version: versionSchema }).parse(body);
        return ok(await updateVisit(actor, id, input.patient, input.version));
      }
      if (resource === 'backoffice') {
        const input = z
          .object({ status: z.enum(['in_progress', 'completed']), version: versionSchema })
          .parse(body);
        return ok(await transitionTask(actor, id, input.status, input.version));
      }
      if (resource === 'accommodations') {
        const input = z
          .object({
            reference: z.string().trim().min(2).max(120),
            address: z.string().trim().min(5).max(500),
            version: versionSchema,
          })
          .parse(body);
        return ok(
          await reserveAccommodation(actor, id, input.reference, input.address, input.version),
        );
      }
      if (resource === 'staff') {
        requireRole(actor, ['admin']);
        const input = z.object({ role: z.enum(roles), version: versionSchema }).parse(body);
        if (id === actor.id) throw new AppError(422, 'Nu vă puteți modifica propriul rol.');
        return ok(
          await transaction(async (db) => {
            const r = await db.query(
              'UPDATE private.staff_profiles SET role=$2,version=version+1 WHERE id=$1 AND version=$3 RETURNING id,role,version',
              [id, input.role, input.version],
            );
            if (!r.rowCount) throw new AppError(409, 'Utilizatorul a fost modificat.');
            return r.rows[0];
          }),
        );
      }
    }
    throw new AppError(404, 'Ruta nu există.');
  } catch (error) {
    return fail(error);
  }
}
export const GET = route;
export const POST = route;
export const PATCH = route;
