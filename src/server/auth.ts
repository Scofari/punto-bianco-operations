import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { database } from './db';
import { AppError, type Staff } from '@/lib/domain';
export async function authClient() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: { getAll: () => jar.getAll(), setAll: (values) => { try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch { /* Server Component: proxy refreshes cookies. */ } } },
  });
}
export async function currentStaff(): Promise<Staff> {
  const client = await authClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new AppError(401, 'Autentificarea este necesară.', 'UNAUTHENTICATED');
  const result = await database().query<Staff>('SELECT id, display_name, role, active FROM private.staff_profiles WHERE id=$1 AND active', [data.user.id]);
  if (!result.rows[0]) throw new AppError(403, 'Contul nu are acces la aplicație.', 'FORBIDDEN');
  return result.rows[0];
}
export async function assertOrigin() {
  const h = await headers();
  const origin = h.get('origin');
  const host = h.get('host');
  const expected = process.env.APP_URL ? new URL(process.env.APP_URL).origin : undefined;
  if (!origin || (origin !== expected && origin !== `https://${host}` && !(process.env.NODE_ENV === 'development' && origin === `http://${host}`))) throw new AppError(403, 'Originea cererii nu este permisă.', 'INVALID_ORIGIN');
}
