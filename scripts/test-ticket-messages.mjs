import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

// Local synthetic database and least-privilege owner; no application secrets.
const name = `messages42_test_${randomBytes(10).toString('hex')}`;
const password = randomBytes(32).toString('hex');
function sql(db, input) {
  execFileSync('docker', ['exec', '-i', 'cifradesk-local-postgres-1', 'psql', '-X', '-U', 'cifradesk', '-d', db, '-v', 'ON_ERROR_STOP=1'], { input, stdio: ['pipe', 'pipe', 'pipe'] });
}
sql('postgres', `CREATE ROLE ${name} LOGIN PASSWORD '${password}'; CREATE DATABASE ${name} OWNER ${name};`);
const root = new URL('../packages/database/prisma/migrations/', import.meta.url);
for (const migration of readdirSync(root).filter(value => /^\d/.test(value)).sort()) {
  sql(name, `SET ROLE ${name};\n` + readFileSync(new URL(`${migration}/migration.sql`, root), 'utf8'));
}
const runner = `import {spawnSync} from 'node:child_process'; let input=''; for await(const chunk of process.stdin) input+=chunk; const env={...process.env,...JSON.parse(input)}; const r=spawnSync('pnpm',['exec','vitest','run','packages/infrastructure/src/ticket-messages.integration.test.ts'],{env,stdio:'inherit'}); process.exit(r.status??1);`;
console.log(`Synthetic database: ${name}`);
const result = spawnSync('docker', ['exec', '-i', 'cifradesk-etapa34-tools', 'node', '--input-type=module', '-e', runner], {
  input: JSON.stringify({ DATABASE_URL: `postgresql://${name}:${password}@postgres:5432/${name}`, TICKET_MESSAGES_TEST_DATABASE: '1' }),
  stdio: ['pipe', 'inherit', 'inherit']
});
process.exit(result.status ?? 1);
