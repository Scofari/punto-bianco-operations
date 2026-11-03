import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { request, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { roles, type Role } from '../src/lib/domain';

const baseURL = process.env.TEST_BASE_URL || 'https://punto-bianco-operations.vercel.app';
const sessions: { role: Role; http: APIRequestContext; client: SupabaseClient; userId: string }[] =
  [];
type SavedSession = {
  role: Role;
  jar: Record<string, string>;
  token: string;
  userId: string;
  expiresAt: number;
};
let saved: SavedSession[] = [];
try {
  saved = JSON.parse(await readFile('.test-sessions.local.json', 'utf8'));
  saved = saved.filter((s) => s.expiresAt > Date.now() / 1000 + 60);
} catch {
  /* First run. */
}
const measurements: { status: number; ms: number; method: string }[] = [];
let subscribed = 0,
  events = 0;
try {
  for (let batch = 0; batch < 10; batch++) {
    const batchResults = await Promise.allSettled(
      Array.from({ length: 5 }, async (_, j) => {
        const i = batch * 5 + j,
          role = roles[i % roles.length];
        let session = saved[i];
        const jar: Record<string, string> = session?.jar ?? {};
        if (!session) {
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
          if (signed.error || !signed.data.session)
            throw Error(
              `Load session ${i} failed to authenticate: ${signed.error?.code ?? 'missing_session'} (${signed.error?.status ?? 0}).`,
            );
          session = {
            role,
            jar,
            token: signed.data.session.access_token,
            userId: signed.data.user.id,
            expiresAt: signed.data.session.expires_at!,
          };
          saved[i] = session;
        }
        const client = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        await client.realtime.setAuth(session.token);
        const http = await request.newContext({
          baseURL,
          extraHTTPHeaders: {
            Origin: new URL(baseURL).origin,
            Cookie: Object.entries(jar)
              .map(([k, v]) => `${k}=${v}`)
              .join('; '),
          },
        });
        sessions.push({ role, http, client, userId: session.userId });
      }),
    );
    await writeFile('.test-sessions.local.json', JSON.stringify(saved.filter(Boolean)));
    const failed = batchResults.find((r) => r.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
  }
  console.log('Authenticated sessions:', sessions.length);
  await Promise.all(
    sessions.map(
      (s, i) =>
        new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(Error(`Realtime subscription ${i} timed out`)),
            30000,
          );
          s.client
            .channel(`load-${i}-${randomUUID()}`)
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `recipient_id=eq.${s.userId}`,
              },
              () => {
                events++;
              },
            )
            .subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                clearTimeout(timeout);
                subscribed++;
                resolve();
              }
            });
        }),
    ),
  );
  console.log('Concurrent authorized realtime subscriptions:', subscribed);
  const admin = sessions.find((s) => s.role === 'admin')!;
  const staff = (await (await admin.http.get('/api/v1/staff')).json()).items;
  const coordinator = staff.find((s: { role: string }) => s.role === 'coordinator');
  const arrival = new Date(Date.now() + 2 * 86400000).toISOString(),
    departure = new Date(Date.now() + 7 * 86400000).toISOString();
  const key = randomUUID();
  const payload = {
    patient: {
      firstName: 'IncarcareDemo',
      lastName: randomUUID().slice(0, 6),
      arrival,
      departure,
      availability: 'Date fictive pentru test de încărcare.',
      treatment: 'Evaluare demonstrativă',
      coordinatorId: coordinator.id,
      apartmentType: 'studio',
      accommodationFree: false,
      freeNights: 0,
      transfer: 'round_trip',
      transferFree: true,
    },
    companion: null,
  };
  const created = await admin.http.post('/api/v1/visits', {
    headers: { 'Idempotency-Key': key },
    data: payload,
  });
  if (created.status() !== 201) throw Error('Load fixture registration failed');
  await Promise.all(sessions.map((s) => s.http.get('/api/v1/me')));
  const from = new Date(Date.now() - 7 * 86400000).toISOString(),
    to = new Date(Date.now() + 14 * 86400000).toISOString();
  for (let round = 0; round < 3; round++)
    await Promise.all(
      sessions.map(async (s, i) => {
        const write = s.role === 'admin';
        const start = performance.now();
        const path =
          s.role === 'driver'
            ? `/api/v1/transfers?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
            : ['accountant', 'accommodation'].includes(s.role)
              ? '/api/v1/accommodations'
              : i % 3 === 0
                ? '/api/v1/notifications'
                : '/api/v1/visits';
        const response = write
          ? await s.http.post('/api/v1/visits', {
              headers: { 'Idempotency-Key': key },
              data: payload,
            })
          : await s.http.get(path);
        await response.body();
        measurements.push({
          status: response.status(),
          ms: performance.now() - start,
          method: write ? 'POST replay' : 'GET',
        });
      }),
    );
  const times = measurements.map((m) => m.ms).sort((a, b) => a - b);
  const failures = measurements.filter((m) => m.status < 200 || m.status >= 300);
  const results = {
    date: new Date().toISOString(),
    target: baseURL,
    authenticatedSessions: sessions.length,
    realtimeSubscriptions: subscribed,
    realtimeEventsObserved: events,
    requests: measurements.length,
    writes: measurements.filter((m) => m.method !== 'GET').length,
    unexpectedErrors: failures.length,
    errorPercent: (failures.length / measurements.length) * 100,
    p50Ms: Math.round(times[Math.floor(times.length * 0.5)]),
    p95Ms: Math.round(times[Math.floor(times.length * 0.95)]),
    maxMs: Math.round(times.at(-1)!),
    limitations:
      'Three rounds at 50 concurrent sessions; repeated seven demo identities with distinct Auth sessions; synthetic small dataset; writes are idempotent registration replays. Not a soak test or a guarantee under sustained production traffic.',
  };
  await writeFile('docs/load-results.json', JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
  if (failures.length || subscribed !== 50 || !events) process.exitCode = 1;
} finally {
  await Promise.all(
    sessions.map(async (s) => {
      await s.client.removeAllChannels();
      s.client.realtime.disconnect();
      await s.http.dispose();
    }),
  );
}
