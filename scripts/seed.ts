import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { database } from '../src/server/db';
import { createVisit } from '../src/server/visits';
import { roles, type Staff, type PersonInput } from '../src/lib/domain';
import { toUtc, today } from '../src/lib/dates';
import { addDays, format } from 'date-fns';

const client = process.env.SUPABASE_SECRET_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
const password = process.env.DEMO_PASSWORD || `Pb!${randomBytes(18).toString('base64url')}`;
const names = [
  'Alexandru Rusu',
  'Elena Popescu',
  'Victor Ceban',
  'Irina Lupu',
  'Mihai Rotaru',
  'Ana Balan',
  'Diana Moraru',
];
const existing = client ? await client.auth.admin.listUsers({ perPage: 1000 }) : null;
if (existing?.error) throw new Error('Unable to access Auth Admin API.');
const staff: Staff[] = [];
const accounts: string[] = [];
for (const [i, role] of roles.entries()) {
  const email = `${role}@demo.puntobianco.test`;
  const provisioned = await database().query<Staff>(
    'SELECT id,display_name,role,active FROM private.staff_profiles WHERE display_name=$1 AND role=$2',
    [names[i], role],
  );
  let user =
    existing?.data.users.find((u) => u.email === email) ??
    (provisioned.rows[0] ? { id: provisioned.rows[0].id } : undefined);
  if (!user) {
    if (!client)
      throw new Error(
        'Provision demo Auth users through the connected admin integration or set SUPABASE_SECRET_KEY.',
      );
    const r = await client.auth.admin.createUser({ email, password, email_confirm: true });
    if (r.error) throw new Error(`Could not provision demo role ${role}: ${r.error.message}`);
    user = r.data.user;
  }
  await database().query(
    'INSERT INTO private.staff_profiles(id,display_name,role) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',
    [user.id, names[i], role],
  );
  staff.push({ id: user.id, display_name: names[i], role, active: true });
  accounts.push(`| ${role} | ${email} | ${password} |`);
}
const hasVisits = await database().query('SELECT count(*)::int AS count FROM private.visits');
if (!hasVisits.rows[0].count) {
  const patients = [
    ['Andrei', 'Munteanu'],
    ['Maria', 'Dumitru'],
    ['Cristina', 'Ionescu'],
    ['Sergiu', 'Ciobanu'],
    ['Alina', 'Marin'],
    ['Daniel', 'Moraru'],
    ['Elena', 'Sandu'],
    ['Victor', 'Balan'],
  ];
  const coordinator = staff.find((s) => s.role === 'coordinator')!;
  const admin = staff[0];
  for (const [i, [firstName, lastName]] of patients.entries()) {
    const day = format(addDays(new Date(`${today()}T12:00:00`), i - 1), 'yyyy-MM-dd');
    const end = format(addDays(new Date(`${day}T12:00:00`), 5), 'yyyy-MM-dd');
    const person: PersonInput = {
      firstName,
      lastName,
      arrival: toUtc(`${day}T${i % 2 ? '14:30' : '10:00'}`),
      departure: toUtc(`${end}T11:00`),
      availability:
        i % 2
          ? 'Disponibil dimineața, între 09:00 și 13:00.'
          : 'Program flexibil pe durata sejurului.',
      treatment: [
        'Consultație și plan de tratament',
        'Implant dentar · evaluare inițială',
        'Igienizare și tratament restaurativ',
        'Control și ajustare lucrare protetică',
      ][i % 4],
      coordinatorId: coordinator.id,
      apartmentType: ['studio', 'one_bed_sofa', 'two_bed', 'two_bed_living'][
        i % 4
      ] as PersonInput['apartmentType'],
      accommodationFree: i % 3 !== 0,
      freeNights: i % 3 !== 0 ? 3 : 0,
      transfer: i === 6 ? 'arrival' : 'round_trip',
      transferFree: i % 3 !== 0,
    };
    const result = await createVisit(
      admin,
      {
        patient: person,
        companion:
          i === 1 ? { hasTreatment: false, firstName: 'Adrian', lastName: 'Dumitru' } : null,
      },
      crypto.randomUUID(),
    );
    if (i % 3 === 1)
      await database().query(
        "UPDATE private.backoffice_tasks SET status='in_progress',owner_id=$2,started_at=now(),version=2 WHERE visit_id=$1",
        [result.id, staff.find((s) => s.role === 'backoffice')!.id],
      );
    if (i % 3 === 2)
      await database().query(
        "UPDATE private.backoffice_tasks SET status='completed',owner_id=$2,started_at=now(),completed_at=now(),version=3 WHERE visit_id=$1",
        [result.id, staff.find((s) => s.role === 'backoffice')!.id],
      );
    if (i % 2 === 0)
      await database().query(
        "UPDATE private.accommodation_requests SET status='reserved',reservation_reference=$2,address=$3,reserved_at=now(),reserved_by=$4,version=2 WHERE visit_id=$1",
        [
          result.id,
          `PB-DEMO-${100 + i}`,
          `Str. Exemplului ${12 + i}, Chișinău · adresă fictivă`,
          staff.find((s) => s.role === 'accommodation')!.id,
        ],
      );
  }
}
await writeFile(
  'credentials.local.md',
  `# Private demo credentials\n\nDo not commit or publish this file. These accounts access invented assessment data only.\n\n| Role | Email | Password |\n|---|---|---|\n${accounts.join('\n')}\n`,
);
console.log(
  'Seven demo accounts provisioned; synthetic visits persisted. Credentials saved privately to credentials.local.md.',
);
await database().end();
