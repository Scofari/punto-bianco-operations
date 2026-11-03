import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
export const TIMEZONE = 'Europe/Chisinau';
export const localDate = (value: string | Date, pattern = 'dd.MM.yyyy HH:mm') => formatInTimeZone(value, TIMEZONE, pattern);
export const toUtc = (value: string) => fromZonedTime(value, TIMEZONE).toISOString();
export const today = () => localDate(new Date(), 'yyyy-MM-dd');
