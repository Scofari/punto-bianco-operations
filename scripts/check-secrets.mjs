import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const names = execFileSync('git', ['diff', '--cached', '--name-only', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const secrets = ['DATABASE_URL', 'DEMO_PASSWORD', 'SUPABASE_SECRET_KEY', 'VERCEL_OIDC_TOKEN']
  .map((k) => process.env[k])
  .filter((v) => v && v.length > 12);
if (process.env.DATABASE_URL) secrets.push(new URL(process.env.DATABASE_URL).password);
let failed = false;
for (const file of names) {
  let content;
  try {
    content = readFileSync(file);
  } catch {
    continue;
  }
  if (secrets.some((s) => content.includes(Buffer.from(s)))) {
    console.error('Secret detected in staged file:', file);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log(`No configured secrets found in ${names.length} staged files.`);
