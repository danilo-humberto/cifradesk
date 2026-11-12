import { createServer } from 'node:http';
import type { HealthResponse } from '@cifradesk/contracts';

export function createHealthServer(role: 'worker' | 'dispatcher') {
  return createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.url !== '/healthz') {
      response.writeHead(404).end();
      return;
    }
    if (request.method !== 'GET') {
      response.writeHead(405, { Allow: 'GET' }).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok', service: role } satisfies HealthResponse));
  });
}
