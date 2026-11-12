import { randomBytes } from 'node:crypto';
import { access, chown, mkdir, writeFile } from 'node:fs/promises';

// Somente gera arquivos novos. Nunca lê ou sobrescreve credenciais existentes.
for (const file of ['.env', '.local/s3.json']) {
  try {
    await access(file);
    console.error('Configuração já existe; preservada. Não execute novamente para regenerar segredos.');
    process.exit(1);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
await mkdir('.local', { recursive: true });
const secret = () => randomBytes(24).toString('hex');
const s3Key = secret();
const s3Secret = secret();
try {
  await writeFile('.local/s3.json', JSON.stringify({ identities: [{ name: 'local-development', credentials: [{ accessKey: s3Key, secretKey: s3Secret }], actions: ['Admin', 'Read', 'Write', 'List', 'Tagging'] }] }), { flag: 'wx', mode: 0o600 });
  // A imagem fixada reduz privilégios para seaweed (UID/GID 1000).
  await chown('.local/s3.json', 1000, 1000);
  await writeFile('.env', [
    'COMPOSE_PROJECT_NAME=cifradesk-local',
    'WEB_PORT=3200', 'MAILPIT_PORT=58025',
    `POSTGRES_PASSWORD=${secret()}`, `REDIS_CACHE_PASSWORD=${secret()}`, `REDIS_QUEUE_PASSWORD=${secret()}`,
    `S3_ACCESS_KEY_ID=${s3Key}`, `S3_SECRET_ACCESS_KEY=${s3Secret}`,
    ''
  ].join('\n'), { flag: 'wx', mode: 0o600 });
  console.log('Configuração local criada. Credenciais não foram exibidas.');
} catch (error) {
  if (error.code === 'EEXIST') {
    console.error('Configuração já existe; preservada. Não execute novamente para regenerar segredos.');
    process.exitCode = 1;
  } else { throw error; }
}
