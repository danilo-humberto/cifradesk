import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocked = vi.hoisted(() => ({ currentUser: vi.fn(), limitAttempts: vi.fn(), createTicket: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/identity', () => ({ currentUser: mocked.currentUser, limitAttempts: mocked.limitAttempts }));
vi.mock('@/lib/server/tickets', () => ({ createTicket: mocked.createTicket }));
vi.mock('@/lib/server/http', async () => import('../../../lib/server/http'));
import { POST } from './route';
import { DomainError } from '@cifradesk/core';
describe('POST /api/tickets', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3200'); });
  const request = () => new Request('http://localhost:3200/api/tickets', { method: 'POST', headers: { origin: 'http://localhost:3200', 'content-type': 'application/json' }, body: '{"title":"teste"}' });
  it('passes only the authenticated actor to the use case and returns 201', async () => {
    mocked.currentUser.mockResolvedValue({ id: 'session-user', authVersion: 3 });
    mocked.createTicket.mockResolvedValue({ id: 'ticket', number: 1 });
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocked.createTicket).toHaveBeenCalledWith({ id: 'session-user', authVersion: 3 }, { title: 'teste' });
  });
  it('rejects absent sessions before invoking the use case', async () => {
    mocked.currentUser.mockRejectedValue(new DomainError(401, 'Entre para continuar.'));
    expect((await POST(request())).status).toBe(401);
    expect(mocked.createTicket).not.toHaveBeenCalled();
  });
});
