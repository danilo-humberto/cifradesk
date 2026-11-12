import { readFile, appendFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
// Explicit local upgrade command. Existing values are never printed or replaced.
const current = await readFile('.env', 'utf8');
const additions = [];
if (!/^BETTER_AUTH_SECRET=/m.test(current)) additions.push('BETTER_AUTH_SECRET=' + randomBytes(32).toString('hex'));
if (!/^BETTER_AUTH_URL=/m.test(current)) additions.push('BETTER_AUTH_URL=http://localhost:' + (current.match(/^WEB_PORT=(\d+)$/m)?.[1] ?? '3200'));
if (additions.length) await appendFile('.env', '\n' + additions.join('\n') + '\n');
console.log('Configuração local de autenticação disponível; valores existentes preservados.');
