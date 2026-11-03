import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServerClient } from '@supabase/ssr';
import { request, type APIRequestContext } from '@playwright/test';
import { database } from '../src/server/db';
import { roles, type Role, type PersonInput } from '../src/lib/domain';
import type {
  VisitRow,
  StaffRow,
  AccommodationRow,
  TransferRow,
  PageResult,
} from '../src/lib/types';

const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const origin = new URL(baseURL).origin;
const sessions = {} as Record<Role, APIRequestContext>;
let checks = 0;
function check(condition: unknown, label: string) {
  assert.ok(condition, label);
  checks++;
  console.log(`PASS ${label}`);
}
try {
  for (const role of roles) {
    const jar: Record<string, string> = {};
    const auth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
          setAll: (values) =>
            values.forEach((v) => {
              jar[v.name] = v.value;
            }),
        },
      },
    );
    const signed = await auth.auth.signInWithPassword({
      email: `${role}@demo.puntobianco.test`,
      password: process.env.DEMO_PASSWORD!,
    });
    assert.equal(signed.error, null, `${role} authenticates`);
    sessions[role] = await request.newContext({
      baseURL,
      extraHTTPHeaders: {
        Origin: origin,
        Cookie: Object.entries(jar)
          .map(([k, v]) => `${k}=${v}`)
          .join('; '),
      },
    });
    check(
      (await sessions[role].get('/api/v1/me')).status() === 200,
      `${role} has a real authenticated session`,
    );
  }
  const anonymous = await request.newContext({ baseURL });
  check(
    (await anonymous.get('/api/v1/visits')).status() === 401,
    'unauthenticated API access is denied',
  );
  await anonymous.dispose();
  const matrix: Record<string, Role[]> = {
    visits: ['admin', 'coordinator', 'backoffice', 'quality'],
    backoffice: ['admin', 'backoffice', 'quality'],
    accommodations: ['admin', 'accommodation', 'accountant', 'quality'],
  };
  for (const [resource, allowed] of Object.entries(matrix))
    for (const role of roles) {
      const response = await sessions[role].get(`/api/v1/${resource}`);
      check(
        response.status() === (allowed.includes(role) ? 200 : 403),
        `${role}: ${resource} permission`,
      );
    }
  for (const role of ['driver', 'accountant', 'accommodation', 'backoffice', 'quality'] as const)
    check(
      (await sessions[role].get('/api/v1/staff')).status() === 403,
      `${role} cannot access the coordinator directory`,
    );
  const accounting = (await (await sessions.accountant.get('/api/v1/accommodations')).json())
    .items as AccommodationRow[];
  check(
    accounting.every((a) => a.address === null && a.reservation_reference === null),
    'accounting responses omit reservation address and reference',
  );
  const staff = (await (await sessions.admin.get('/api/v1/staff')).json()).items as StaffRow[];
  const coordinator = staff.find((s) => s.role === 'coordinator')!;
  const now = new Date();
  const arrival = new Date(now.getTime() + 86400000);
  arrival.setUTCHours(12, 30, 0, 0);
  const departure = new Date(arrival.getTime() + 5 * 86400000);
  const suffix = randomUUID().slice(0, 6);
  const patient: PersonInput = {
    firstName: `Evaluare${suffix}`,
    lastName: 'PacientFictiv',
    arrival: arrival.toISOString(),
    departure: departure.toISOString(),
    availability: 'Date inventate pentru verificare.',
    treatment: 'Tratament demonstrativ confidențial',
    coordinatorId: coordinator.id,
    apartmentType: 'studio',
    accommodationFree: true,
    freeNights: 3,
    transfer: 'round_trip',
    transferFree: true,
  };
  const companion = {
    ...patient,
    firstName: `Insotitor${suffix}`,
    lastName: 'PacientFictiv',
    treatment: 'Consultație demonstrativă',
  };
  const key = randomUUID();
  const payload = { patient, companion: { hasTreatment: true, patient: companion } };
  const created = await sessions.coordinator.post('/api/v1/visits', {
    headers: { 'Idempotency-Key': key },
    data: payload,
  });
  check(
    created.status() === 201,
    'coordinator registers primary and treated companion transactionally',
  );
  const result = await created.json();
  const repeated = await sessions.coordinator.post('/api/v1/visits', {
    headers: { 'Idempotency-Key': key },
    data: payload,
  });
  check(
    repeated.status() === 200 && (await repeated.json()).id === result.id,
    'retry reuses the original visit',
  );
  check(
    (
      await sessions.coordinator.post('/api/v1/visits', {
        headers: { 'Idempotency-Key': key },
        data: { ...payload, patient: { ...patient, lastName: 'Changed' } },
      })
    ).status() === 409,
    'idempotency key rejects a different payload',
  );
  check(
    (
      await sessions.coordinator.post('/api/v1/visits', {
        headers: { 'Idempotency-Key': randomUUID() },
        data: { patient: { ...patient, departure: patient.arrival }, companion: null },
      })
    ).status() === 422,
    'inverted or equal dates are rejected',
  );
  const first = (await (await sessions.coordinator.get(`/api/v1/visits/${result.id}`)).json())
    .items[0] as VisitRow;
  check(!!first.companion_visit_id, 'treated companion has a complete linked visit');
  const task = await Promise.all(
    [1, 2].map(() =>
      sessions.backoffice.patch(`/api/v1/backoffice/${first.task_id}`, {
        data: { status: 'in_progress', version: first.task_version },
      }),
    ),
  );
  check(
    task.filter((r) => r.status() === 200).length === 1 &&
      task.filter((r) => r.status() === 409).length === 1,
    'concurrent case claims produce exactly one winner',
  );
  const taskVersion = (await task.find((r) => r.status() === 200)!.json()).version;
  check(
    (
      await sessions.backoffice.patch(`/api/v1/backoffice/${first.task_id}`, {
        data: { status: 'completed', version: taskVersion },
      })
    ).status() === 200,
    'back office completes a started case',
  );
  for (const role of ['accountant', 'quality', 'driver'] as const)
    check(
      (
        await sessions[role].patch(`/api/v1/visits/${first.id}`, {
          data: { patient, version: first.version },
        })
      ).status() === 403,
      `${role} cannot edit visits`,
    );
  const lodgingPage = (await (
    await sessions.accommodation.get('/api/v1/accommodations')
  ).json()) as PageResult<AccommodationRow>;
  const lodging = lodgingPage.items.find((a) => a.visit_id === first.id)!;
  check(!!lodging, 'lodging request is persisted');
  check(
    !JSON.stringify(lodgingPage).includes(patient.treatment) && !('treatment' in lodging),
    'accommodation API excludes clinical treatment',
  );
  check(
    (
      await sessions.accommodation.patch(`/api/v1/accommodations/${lodging.id}`, {
        data: {
          reference: 'QA-FICTIV',
          address: 'Strada Fictivă 12, Chișinău',
          version: lodging.version,
        },
      })
    ).status() === 200,
    'accommodation manager reserves lodging',
  );
  check(
    (
      await sessions.accountant.patch(`/api/v1/accommodations/${lodging.id}`, {
        data: { reference: 'NO', address: 'Denied', version: lodging.version + 1 },
      })
    ).status() === 403,
    'accountant is read-only for reservations',
  );
  const from = new Date(arrival.getTime() - 86400000).toISOString(),
    to = new Date(departure.getTime() + 86400000).toISOString();
  const transfers = (
    await (
      await sessions.driver.get(
        `/api/v1/transfers?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      )
    ).json()
  ).items as TransferRow[];
  const grouped = transfers.filter((t) => t.passengers.includes(patient.firstName));
  check(
    grouped.length === 2 &&
      grouped.every((t) => t.passenger_count === 2 && t.passengers.includes(companion.firstName)),
    'round-trip companion transfers are grouped into two calendar events',
  );
  check(
    !JSON.stringify(transfers).includes(patient.treatment) &&
      transfers.every((t) => !('treatment' in t)),
    'driver responses exclude treatment',
  );
  const changed = { ...patient, treatment: 'Tratament actualizat demonstrativ' };
  check(
    (
      await sessions.coordinator.patch(`/api/v1/visits/${first.id}`, {
        data: { patient: changed, version: first.version },
      })
    ).status() === 200,
    'coordinator edits assigned visit',
  );
  let updated = (await (await sessions.coordinator.get(`/api/v1/visits/${first.id}`)).json())
    .items[0] as VisitRow;
  check(
    updated.task_status === 'completed' && updated.accommodation_status === 'reserved',
    'clinical edit preserves completed back-office work and reservation',
  );
  check(
    (
      await sessions.coordinator.patch(`/api/v1/visits/${first.id}`, {
        data: { patient: changed, version: first.version },
      })
    ).status() === 409,
    'stale visit update is rejected',
  );
  const reset = await sessions.coordinator.patch(`/api/v1/visits/${first.id}`, {
    data: { patient: { ...changed, apartmentType: 'two_bed' }, version: updated.version },
  });
  check(
    reset.status() === 200 && (await reset.json()).lodgingReset === true,
    'lodging requirement change resets existing reservation',
  );
  updated = (await (await sessions.coordinator.get(`/api/v1/visits/${first.id}`)).json()).items[0];
  check(
    updated.accommodation_status === 'unprocessed' && updated.address === null,
    'stale reservation details are cleared',
  );
  for (const role of ['backoffice', 'accommodation', 'driver'] as const) {
    const n = await (await sessions[role].get('/api/v1/notifications')).json();
    check(
      n.items.some((item: { resource_id: string }) => item.resource_id === first.id),
      `${role} receives persisted automatic notifications`,
    );
  }
  const badOrigin = await sessions.admin.post('/api/v1/visits', {
    headers: { Origin: 'https://untrusted.example', 'Idempotency-Key': randomUUID() },
    data: payload,
  });
  check(badOrigin.status() === 403, 'cross-origin browser mutations are denied');
  const before = await database().query(
    'SELECT count(*)::int AS n FROM private.visits WHERE id=$1',
    [first.id],
  );
  check(before.rows[0].n === 1, 'creation retry persisted exactly one primary visit');
  console.log(`Integration checks passed: ${checks}`);
} finally {
  await Promise.all(Object.values(sessions).map((s) => s.dispose()));
  await database().end();
}
