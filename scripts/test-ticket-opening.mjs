import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

// Existing, explicitly authorized LOCAL Docker; synthetic DB and dedicated role.
// Credentials are generated in memory and passed on stdin, never logged.
const suffix = randomBytes(10).toString('hex');
const name = `tickets34_test_${suffix}`;
const password = randomBytes(32).toString('hex');
function sql(db, input) {
  execFileSync('docker', ['exec', '-i', 'cifradesk-local-postgres-1', 'psql', '-X', '-U', 'cifradesk', '-d', db, '-v', 'ON_ERROR_STOP=1'], { input, stdio: ['pipe', 'pipe', 'pipe'] });
}
sql('postgres', `CREATE ROLE ${name} LOGIN PASSWORD '${password}'; CREATE DATABASE ${name} OWNER ${name};`);
const root = new URL('../packages/database/prisma/migrations/', import.meta.url);
for (const migration of readdirSync(root).filter(name => /^\d/.test(name)).sort()) {
  sql(name, `SET ROLE ${name};\n` + readFileSync(new URL(`${migration}/migration.sql`, root), 'utf8'));
}
const runner = `import {spawnSync} from 'node:child_process'; let input=''; for await(const chunk of process.stdin) input+=chunk; const env={...process.env,...JSON.parse(input)}; const r=spawnSync('pnpm',['exec','vitest','run','packages/infrastructure/src/tickets.integration.test.ts'],{env,stdio:'inherit'}); process.exit(r.status??1);`;
console.log(`Synthetic database: ${name}`);
const result = spawnSync('docker', ['exec', '-i', 'cifradesk-etapa34-tools', 'node', '--input-type=module', '-e', runner], {
  input: JSON.stringify({ DATABASE_URL: `postgresql://${name}:${password}@postgres:5432/${name}`, TICKETS_TEST_DATABASE: '1',
    S3_ENDPOINT: 'http://seaweedfs:8333', S3_BUCKET: `tickets34-test-${suffix}`,
    ...(() => {
      // Explicit local S3 authorization. Consume configuration in memory only.
      const config = JSON.parse(readFileSync(new URL('../.local/s3.json', import.meta.url), 'utf8'));
      const credential = config.identities.find(i => i.name === 'local-development')?.credentials[0];
      if (!credential) throw new Error('Credencial local de teste indisponível.');
      return { S3_ACCESS_KEY_ID: credential.accessKey, S3_SECRET_ACCESS_KEY: credential.secretKey };
    })()
  }), stdio: ['pipe', 'inherit', 'inherit']
});
process.exit(result.status ?? 1);
