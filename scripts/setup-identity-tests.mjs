import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('.local', { recursive: true });
const password = randomBytes(24).toString('hex');
try {
  await writeFile('.local/identity-test.env', [
    'POSTGRES_PASSWORD=' + password, 'POSTGRES_USER=identity_test', 'POSTGRES_DB=identity_test',
    'DATABASE_URL=postgresql://identity_test:' + password + '@identity-postgres:5432/identity_test',
    'BETTER_AUTH_SECRET=' + randomBytes(32).toString('hex'), 'BETTER_AUTH_URL=http://localhost:3000',
    'SMTP_HOST=identity-mailpit', 'SMTP_PORT=1025', 'SMTP_FROM=CifraDesk <noreply@cifradesk.local>',
    'IDENTITY_TEST_DATABASE=1'
  ].join('\n'), { flag: 'wx', mode: 0o600 });
  console.log('Configuração sintética criada sem exibir credenciais.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Configuração de testes existente preservada.');
}
