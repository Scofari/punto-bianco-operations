import { readFile, readdir } from 'node:fs/promises';
import { database, transaction } from '../src/server/db';
if (!process.env.MIGRATION_DATABASE_URL)
  throw new Error(
    'Set MIGRATION_DATABASE_URL to an administrator connection for a NEW database. The restricted runtime login cannot apply DDL. For an existing Supabase migration history, use the Supabase CLI or dashboard instead.',
  );
process.env.DATABASE_URL = process.env.MIGRATION_DATABASE_URL;
const names = (await readdir(new URL('../supabase/migrations/', import.meta.url)))
  .filter((n) => n.endsWith('.sql'))
  .sort();
await transaction(async (db) => {
  await db.query('CREATE SCHEMA IF NOT EXISTS private');
  await db.query(
    'CREATE TABLE IF NOT EXISTS private.schema_migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())',
  );
  for (const name of names) {
    if ((await db.query('SELECT 1 FROM private.schema_migrations WHERE name=$1', [name])).rowCount)
      continue;
    await db.query(
      await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'),
    );
    await db.query('INSERT INTO private.schema_migrations(name) VALUES($1)', [name]);
  }
});
console.log('Database migrations applied.');
await database().end();
