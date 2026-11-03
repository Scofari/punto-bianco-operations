import { z } from 'zod';

export const roles = ['admin', 'coordinator', 'backoffice', 'accommodation', 'driver', 'accountant', 'quality'] as const;
export type Role = typeof roles[number];
export type Staff = { id: string; display_name: string; role: Role; active: boolean };
export const apartmentTypes = ['studio', 'one_bed_sofa', 'two_bed', 'two_bed_living'] as const;
export const personSchema = z.object({
  firstName: z.string().trim().min(2).max(80), lastName: z.string().trim().min(2).max(80),
  arrival: z.iso.datetime({ offset: true }), departure: z.iso.datetime({ offset: true }),
  availability: z.string().trim().max(2000), treatment: z.string().trim().min(2).max(5000),
  coordinatorId: z.uuid(), apartmentType: z.enum(apartmentTypes),
  accommodationFree: z.boolean(), freeNights: z.number().int().min(0).max(365),
  transfer: z.enum(['none', 'arrival', 'departure', 'round_trip']), transferFree: z.boolean(),
}).superRefine((v, ctx) => {
  if (Date.parse(v.departure) <= Date.parse(v.arrival)) ctx.addIssue({ code: 'custom', path: ['departure'], message: 'Plecarea trebuie să fie după sosire.' });
  if (!v.accommodationFree && v.freeNights !== 0) ctx.addIssue({ code: 'custom', path: ['freeNights'], message: 'Selectați cazare gratuită sau zero nopți gratuite.' });
  const nights = Math.ceil((Date.parse(v.departure) - Date.parse(v.arrival)) / 86400000);
  if (v.freeNights > nights) ctx.addIssue({ code: 'custom', path: ['freeNights'], message: 'Nopțile gratuite depășesc durata sejurului.' });
});
export const visitSchema = z.object({
  patient: personSchema,
  companion: z.discriminatedUnion('hasTreatment', [
    z.object({ hasTreatment: z.literal(false), firstName: z.string().trim().min(2).max(80), lastName: z.string().trim().min(2).max(80) }),
    z.object({ hasTreatment: z.literal(true), patient: personSchema }),
  ]).nullable(),
});
export type PersonInput = z.infer<typeof personSchema>;
export type VisitInput = z.infer<typeof visitSchema>;
export class AppError extends Error {
  constructor(public status: number, message: string, public code = 'REQUEST_ERROR') { super(message); }
}
export function requireRole(staff: Staff, allowed: readonly Role[]) {
  if (!allowed.includes(staff.role)) throw new AppError(403, 'Nu aveți permisiune pentru această acțiune.', 'FORBIDDEN');
}
export function canManageVisit(staff: Staff, coordinatorId: string) {
  return staff.role === 'admin' || (staff.role === 'coordinator' && staff.id === coordinatorId);
}
export function nextTaskStatus(current: string, requested: string) {
  return (current === 'new' && requested === 'in_progress') || (current === 'in_progress' && requested === 'completed');
}
export function transferDirections(value: PersonInput['transfer']) {
  return value === 'round_trip' ? ['arrival', 'departure'] as const : value === 'none' ? [] : [value];
}
