import { createHealthServer } from './health-server.js';

const role = process.env.PROCESS_ROLE ?? 'worker';
if (role !== 'worker' && role !== 'dispatcher') throw new Error('PROCESS_ROLE inválido');

const server = createHealthServer(role);
server.listen(3001, '0.0.0.0', () => {
  console.log(JSON.stringify({ event: 'process.started', service: role, mode: 'foundation' }));
});

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log(JSON.stringify({ event: 'process.stopping', service: role }));
  server.close(error => {
    if (error) process.exitCode = 1;
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
