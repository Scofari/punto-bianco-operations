import { Pool, type PoolClient } from 'pg';
let pool: Pool | undefined;
export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_NOT_CONFIGURED');
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 3, idleTimeoutMillis: 20000, connectionTimeoutMillis: 10000, statement_timeout: 15000, ssl: { rejectUnauthorized: true } });
  return pool;
}
export async function transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await database().connect();
  try { await client.query('BEGIN'); const result = await run(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
