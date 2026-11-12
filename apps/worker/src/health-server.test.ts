import { afterEach, describe, expect, it } from 'vitest';
import { createHealthServer } from './health-server.js';
import type { Server } from 'node:http';

let server: Server | undefined;
afterEach(async () => {
  if (server?.listening) await new Promise<void>((resolve, reject) => server!.close(e => e ? reject(e) : resolve()));
});

describe('liveness do processo', () => {
  it.each(['worker', 'dispatcher'] as const)('identifica %s e não expõe outras rotas', async role => {
    server = createHealthServer(role);
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Porta de teste ausente');
    const url = `http://127.0.0.1:${address.port}`;
    const response = await fetch(`${url}/healthz`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ status: 'ok', service: role });
    expect((await fetch(`${url}/other`)).status).toBe(404);
    expect((await fetch(`${url}/healthz`, { method: 'POST' })).status).toBe(405);
  });
});
