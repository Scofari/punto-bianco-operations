import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
export const TIMEZONE = 'Europe/Chisinau';
export const localDate = (value: string | Date, pattern = 'dd.MM.yyyy HH:mm') =>
  formatInTimeZone(value, TIMEZONE, pattern);
export const toUtc = (value: string) => fromZonedTime(value, TIMEZONE).toISOString();
export const today = () => localDate(new Date(), 'yyyy-MM-dd');
// Use UTC noon as a calendar-date carrier; never use the viewer's timezone for clinic weeks.
export function shiftCalendarDays(value: Date, days: number) {
  const shifted = new Date(value);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted;
}
export function clinicWeekStart(value: string | Date = new Date()) {
  const day = new Date(`${localDate(value, 'yyyy-MM-dd')}T12:00:00Z`);
  return shiftCalendarDays(day, -((day.getUTCDay() + 6) % 7));
}
export function stayNights(arrival: string, departure: string) {
  if (!Number.isFinite(Date.parse(arrival)) || !Number.isFinite(Date.parse(departure))) return 0;
  const start = localDate(arrival, 'yyyy-MM-dd');
  const end = localDate(departure, 'yyyy-MM-dd');
  return Math.max(
    0,
    Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000),
  );
}
