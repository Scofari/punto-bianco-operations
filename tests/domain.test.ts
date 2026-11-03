import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canManageVisit,
  nextTaskStatus,
  personSchema,
  requireRole,
  transferDirections,
  visitSchema,
  type Staff,
  roles,
} from '../src/lib/domain';
import { toUtc, localDate } from '../src/lib/dates';
const person = {
  firstName: 'Andrei',
  lastName: 'Munteanu',
  arrival: '2026-11-03T12:00:00.000Z',
  departure: '2026-11-08T10:00:00.000Z',
  availability: 'Dimineața',
  treatment: 'Consultație și igienizare',
  coordinatorId: '8ab730ae-419b-4b3c-8aa2-7c1bf108f043',
  apartmentType: 'studio' as const,
  accommodationFree: true,
  freeNights: 3,
  transfer: 'round_trip' as const,
  transferFree: true,
};
test('registration validates all fields and rejects inverted dates', () => {
  assert.equal(personSchema.safeParse(person).success, true);
  assert.equal(personSchema.safeParse({ ...person, departure: person.arrival }).success, false);
  assert.equal(personSchema.safeParse({ ...person, freeNights: 20 }).success, false);
  assert.equal(personSchema.safeParse({ ...person, accommodationFree: false }).success, false);
});
test('treated companion requires a complete independent visit', () => {
  assert.equal(
    visitSchema.safeParse({
      patient: person,
      companion: { hasTreatment: true, patient: { firstName: 'Maria' } },
    }).success,
    false,
  );
  assert.equal(
    visitSchema.safeParse({
      patient: person,
      companion: { hasTreatment: true, patient: { ...person, firstName: 'Maria' } },
    }).success,
    true,
  );
});
test('one-way and round-trip directions do not invent extra legs', () => {
  assert.deepEqual(transferDirections('none'), []);
  assert.deepEqual(transferDirections('arrival'), ['arrival']);
  assert.deepEqual(transferDirections('departure'), ['departure']);
  assert.deepEqual(transferDirections('round_trip'), ['arrival', 'departure']);
});
test('back-office workflow cannot skip start or reopen completed work', () => {
  assert.equal(nextTaskStatus('new', 'completed'), false);
  assert.equal(nextTaskStatus('new', 'in_progress'), true);
  assert.equal(nextTaskStatus('in_progress', 'completed'), true);
  assert.equal(nextTaskStatus('completed', 'in_progress'), false);
});
test('all roles obey least-privilege visit and mutation checks', () => {
  for (const role of roles) {
    const staff: Staff = { id: person.coordinatorId, display_name: 'Demo', role, active: true };
    assert.equal(
      canManageVisit(staff, person.coordinatorId),
      ['admin', 'coordinator'].includes(role),
    );
    if (!['admin', 'coordinator'].includes(role))
      assert.throws(() => requireRole(staff, ['admin', 'coordinator']));
  }
  const coordinator: Staff = {
    id: person.coordinatorId,
    display_name: 'Demo',
    role: 'coordinator',
    active: true,
  };
  assert.equal(canManageVisit(coordinator, 'different'), false);
});
test('clinic-local date conversion respects winter and summer timezone offsets', () => {
  assert.equal(toUtc('2026-11-03T14:30'), '2026-11-03T12:30:00.000Z');
  assert.equal(toUtc('2026-07-03T14:30'), '2026-07-03T11:30:00.000Z');
  assert.equal(localDate('2026-11-03T12:30:00Z', 'HH:mm'), '14:30');
});
