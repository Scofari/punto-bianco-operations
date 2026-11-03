import { spawnSync } from 'node:child_process';
const cli = 'C:/Users/Scofa/AppData/Roaming/npm/node_modules/vercel/dist/index.js';
const values = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  APP_URL: 'https://punto-bianco-operations.vercel.app',
};
for (const [key, value] of Object.entries(values)) {
  if (!value) throw Error(`Missing ${key}`);
  const result = spawnSync(
    process.execPath,
    [
      cli,
      'env',
      'add',
      key,
      'production,preview',
      '--force',
      '--yes',
      ...(key === 'DATABASE_URL' ? ['--sensitive'] : []),
    ],
    { input: value, encoding: 'utf8', cwd: process.cwd() },
  );
  if (result.status !== 0) {
    console.error(`Failed to configure ${key}`);
    process.exit(1);
  }
  console.log(`Configured ${key} securely.`);
}
