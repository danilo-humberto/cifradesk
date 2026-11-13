import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainError } from '@cifradesk/core';
const mocked = vi.hoisted(() => ({ currentUser: vi.fn(), limitAttempts: vi.fn(), operateTicket: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/identity', () => ({ currentUser: mocked.currentUser, limitAttempts: mocked.limitAttempts }));
vi.mock('@/lib/server/tickets', () => ({ operateTicket: mocked.operateTicket }));
vi.mock('@/lib/server/http', async () => import('../../../lib/server/http'));
import { POST } from './[id]/operations/[operation]/route';

describe('ticket operation HTTP', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3200'); });
  const request = (origin = 'http://localhost:3200', payload = '{"expectedVersion":1,"priority":"HIGH"}') => new Request('http://localhost:3200/api/tickets/id/operations/update', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: payload });
  const context = (operation = 'update') => ({ params: Promise.resolve({ id: 'id', operation }) });
  it('uses the session actor, returns the committed version and disables caching', async () => {
    mocked.currentUser.mockResolvedValue({ id: 'actor', authVersion: 2 });
    mocked.operateTicket.mockResolvedValue({ id: 'id', version: 2 });
    const response = await POST(request(), context());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocked.operateTicket).toHaveBeenCalledWith({ id: 'actor', authVersion: 2 }, 'id', 'update', { expectedVersion: 1, priority: 'HIGH' });
  });
  it('rejects cross origin, unknown actions, malformed and oversized bodies', async () => {
    mocked.currentUser.mockResolvedValue({ id: 'actor', authVersion: 1 });
    expect((await POST(request('http://evil.test'), context())).status).toBe(403);
    expect((await POST(request(), context('delete'))).status).toBe(400);
    expect((await POST(request(undefined, '{'), context())).status).toBe(400);
    expect((await POST(request(undefined, 'a'.repeat(65537)), context())).status).toBe(413);
    expect(mocked.operateTicket).not.toHaveBeenCalled();
  });
  it('propagates authentication and optimistic conflict errors', async () => {
    mocked.currentUser.mockRejectedValueOnce(new DomainError(401, 'Sessão encerrada'));
    expect((await POST(request(), context())).status).toBe(401);
    mocked.currentUser.mockResolvedValue({ id: 'actor' });
    mocked.operateTicket.mockRejectedValue(new DomainError(409, 'Recarregue'));
    expect((await POST(request(), context())).status).toBe(409);
  });
});
