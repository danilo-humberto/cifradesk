import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainError } from '@cifradesk/core';
const mocks = vi.hoisted(() => ({ currentUser: vi.fn(), listTickets: vi.fn(), getTicket: vi.fn(), listTicketActivities: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/identity', () => ({ currentUser: mocks.currentUser }));
vi.mock('@cifradesk/infrastructure', () => ({ ...mocks, createTicket: vi.fn(), uploadAttachments: vi.fn(), downloadAttachment: vi.fn(), assertAttachmentAccess: vi.fn() }));
vi.mock('@/lib/server/tickets', async () => import('../../../lib/server/tickets'));
vi.mock('@/lib/server/http', async () => import('../../../lib/server/http'));
import { GET as mine } from './mine/route';
import { GET as queue } from './queue/route';
import { GET as detail } from './[id]/route';
import { GET as activities } from './[id]/activities/route';
const actor = { id: 'session-user', authVersion: 2 };
const id = '00000000-0000-4000-8000-000000000001';
const context = { params: Promise.resolve({ id }) };
const request = (query = '') => new Request('http://localhost:3200/api/tickets' + query);
describe('ticket query HTTP handlers', () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.currentUser.mockResolvedValue(actor); });
  it('uses the session and explicit scope, returning uncached paginated responses', async () => {
    mocks.listTickets.mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 25 });
    for (const [handler, scope] of [[mine, 'mine'], [queue, 'queue']] as const) {
      const response = await handler(request('?page=2'));
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(mocks.listTickets).toHaveBeenLastCalledWith(actor, scope, { page: '2' });
    }
  });
  it('passes the authenticated actor and route ID to detail and history', async () => {
    mocks.getTicket.mockResolvedValue({ id }); mocks.listTicketActivities.mockResolvedValue({ items: [] });
    expect((await detail(request(), context)).status).toBe(200);
    expect(mocks.getTicket).toHaveBeenCalledWith(actor, id);
    expect((await activities(request('?pageSize=1'), context)).status).toBe(200);
    expect(mocks.listTicketActivities).toHaveBeenCalledWith(actor, id, { pageSize: '1' });
  });
  it('rejects duplicate query parameters instead of silently choosing a value', async () => {
    expect((await mine(request('?page=1&page=2'))).status).toBe(400);
    expect((await activities(request('?page=1&page=2'), context)).status).toBe(400);
    expect(mocks.listTickets).not.toHaveBeenCalled();
    expect(mocks.listTicketActivities).not.toHaveBeenCalled();
  });
  it('rejects anonymous requests before any query', async () => {
    mocks.currentUser.mockRejectedValue(new DomainError(401, 'Entre para continuar.'));
    for (const handler of [mine, queue]) expect((await handler(request())).status).toBe(401);
    for (const handler of [detail, activities]) expect((await handler(request(), context)).status).toBe(401);
    expect(mocks.listTickets).not.toHaveBeenCalled(); expect(mocks.getTicket).not.toHaveBeenCalled();
    expect(mocks.listTicketActivities).not.toHaveBeenCalled();
  });
  it('returns the same 404 for inaccessible and missing items', async () => {
    mocks.getTicket.mockRejectedValue(new DomainError(404, 'Chamado não encontrado.'));
    expect((await detail(request(), context)).status).toBe(404);
  });
});
