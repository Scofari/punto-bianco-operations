import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const signed = await client.auth.signInWithPassword({
  email: 'driver@demo.puntobianco.test',
  password: process.env.DEMO_PASSWORD!,
});
assert.equal(signed.error, null);
const own = await client.from('notifications').select('*');
assert.equal(own.error, null);
assert.ok(own.data?.every((n) => n.recipient_id === signed.data.user!.id));
const other = await client
  .from('notifications')
  .select('*')
  .neq('recipient_id', signed.data.user!.id);
assert.equal(other.data?.length, 0);
const anonymous = await anon.from('notifications').select('*');
assert.ok(anonymous.error);
const mutation = await client.from('notifications').insert({
  recipient_id: signed.data.user!.id,
  event_type: 'unauthorized',
  resource_id: crypto.randomUUID(),
});
assert.ok(mutation.error);
const privateSchema = await fetch(`${url}/rest/v1/visits?select=id`, {
  headers: {
    apikey: key,
    Authorization: `Bearer ${signed.data.session!.access_token}`,
    'Accept-Profile': 'private',
  },
});
assert.ok(privateSchema.status >= 400);
const signup = await anon.auth.signUp({
  email: `signup-check-${Date.now()}@demo.puntobianco.test`,
  password: 'ThisAccountMustNeverBeCreated!9123',
});
assert.equal(signup.error?.code, 'signup_disabled', 'Public signup must be disabled');
console.log(
  'PASS direct database API: private schema hidden, recipient-only notification RLS, anonymous access denied, writes denied, public signup disabled.',
);
client.realtime.disconnect();
anon.realtime.disconnect();
