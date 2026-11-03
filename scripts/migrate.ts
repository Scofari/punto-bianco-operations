import { readFile } from 'node:fs/promises';
import { database, transaction } from '../src/server/db';
await transaction(async (db) => {
  await db.query('CREATE TABLE IF NOT EXISTS private_migration_history (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())');
  const name = '20261103160000_initial.sql';
  if ((await db.query('SELECT 1 FROM private_migration_history WHERE name=$1', [name])).rowCount) return;
  await db.query(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'));
  await db.query('INSERT INTO private_migration_history(name) VALUES($1)', [name]);
});
console.log('Database migrations applied.');
await database().end();
