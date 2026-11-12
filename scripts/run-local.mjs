import { spawnSync } from 'node:child_process';
// Load secrets with Node --env-file before invoking this wrapper; never echo them.
const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error('Informe o comando.');
const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
