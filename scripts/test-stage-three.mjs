import { spawnSync } from 'node:child_process';

// Run on the host: each existing runner enforces its synthetic database boundary.
// Sequential execution avoids resource contention and stops on the first failure.
const commands = [
  ['docker', ['exec', 'cifradesk-etapa34-tools', 'pnpm', 'test:integration']],
  ...['persistence', 'opening', 'queries', 'operations'].map(name => [process.execPath, [`scripts/test-ticket-${name}.mjs`]])
];
for (const [command, args] of commands) {
  console.log(`Running ${args.at(-1)}`);
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
