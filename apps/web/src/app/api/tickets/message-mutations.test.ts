import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainError } from '@cifradesk/core';
import { ticketMessagePageInput } from '@cifradesk/contracts/tickets';
const mocked = vi.hoisted(() => ({ currentUser: vi.fn(), limitAttempts: vi.fn(), editTicketMessage: vi.fn(), deleteTicketMessage: vi.fn(), listTicketMessageRevisions: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@cifradesk/infrastructure', () => ({ editTicketMessage: mocked.editTicketMessage, deleteTicketMessage: mocked.deleteTicketMessage, listTicketMessageRevisions: mocked.listTicketMessageRevisions }));
vi.mock('@/lib/server/identity', () => ({ currentUser: mocked.currentUser, limitAttempts: mocked.limitAttempts }));
vi.mock('@/lib/server/tickets', async () => import('../../../lib/server/tickets'));
vi.mock('@/lib/server/http', async () => import('../../../lib/server/http'));
import { PATCH, DELETE } from './[id]/messages/[messageId]/route';
import { GET } from './[id]/messages/[messageId]/revisions/route';

describe('message mutation HTTP', () => {
  const id = '00000000-0000-4000-8000-000000000044', messageId = '00000000-0000-4000-8000-000000000045';
  const url = `http://localhost:3200/api/tickets/${id}/messages/${messageId}`;
  const context = () => ({ params: Promise.resolve({ id, messageId }) });
  function request(fields: Array<[string, string | File]> = [['expectedVersion', '2'], ['markdown', '**Correção**'], ['retainedAttachmentIds', JSON.stringify([id])]]) {
    const form = new FormData();
    for (const [key, value] of fields) form.append(key, value);
    return new Request(url, { method: 'PATCH', headers: { origin: 'http://localhost:3200' }, body: form });
  }
  const deletion = (data: unknown = { expectedVersion: 2 }) => new Request(url, { method: 'DELETE', headers: { origin: 'http://localhost:3200', 'content-type': 'application/json' }, body: JSON.stringify(data) });
  beforeEach(() => {
    vi.resetAllMocks(); vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3200');
    mocked.currentUser.mockResolvedValue({ id: 'session-user', authVersion: 3 });
    mocked.editTicketMessage.mockResolvedValue({ id: messageId, version: 3 });
    mocked.deleteTicketMessage.mockResolvedValue({ id: messageId, version: 3, markdown: null });
    mocked.listTicketMessageRevisions.mockImplementation(async (_actor, _id, _messageId, query) => ({ ...ticketMessagePageInput.parse(query), total: 0, items: [] }));
  });
  afterEach(() => vi.unstubAllEnvs());

  it('parses an edit using the session author, retained ids and separate new bytes with a no-store response', async () => {
    const response = await PATCH(request([['expectedVersion', '2'], ['markdown', ''], ['retainedAttachmentIds', JSON.stringify([id])], ['files', new File(['new'], 'new.txt', { type: 'text/plain' })]]), context());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocked.editTicketMessage).toHaveBeenCalledWith({ id: 'session-user', authVersion: 3 }, id, messageId, { expectedVersion: 2, markdown: '', retainedAttachmentIds: [id] }, [{ originalName: 'new.txt', mimeType: 'text/plain', bytes: Buffer.from('new') }]);
    expect(mocked.limitAttempts).toHaveBeenCalledWith('ticket:message:session-user', 60);
  });
  it('rejects missing, repeated, forged and invalid edit fields before the service', async () => {
    const base: Array<[string, string]> = [['expectedVersion', '2'], ['markdown', 'ok'], ['retainedAttachmentIds', '[]']];
    for (const fields of [base.slice(1), base.slice(0, 2), [...base, ['visibility', 'INTERNAL']], [...base, ['authorId', 'forged']], [...base, ['expectedVersion', '3']], [...base, ['files', 'forged']], [['expectedVersion', '0'], ...base.slice(1)], [['expectedVersion', '2x'], ...base.slice(1)], [base[0]!, ['markdown', 'x'.repeat(10001)], base[2]!], [...base.slice(0, 2), ['retainedAttachmentIds', 'broken']], [...base.slice(0, 2), ['retainedAttachmentIds', JSON.stringify([id, id])]], [...base.slice(0, 2), ['retainedAttachmentIds', '{}']]] as Array<Array<[string, string | File]>>) expect((await PATCH(request(fields), context())).status).toBe(400);
    expect(mocked.editTicketMessage).not.toHaveBeenCalled();
  });
  it('limits actual bytes, malformed multipart, active file count and individual file size', async () => {
    const base: Array<[string, string | File]> = [['expectedVersion', '2'], ['markdown', 'ok'], ['retainedAttachmentIds', '[]']];
    expect((await PATCH(request([...base, ...Array.from({ length: 6 }, (): [string, File] => ['files', new File(['x'], 'x.txt')])]), context())).status).toBe(400);
    expect((await PATCH(request([...base, ['files', new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'big.txt')]]), context())).status).toBe(400);
    expect((await PATCH(request([...base.slice(0, 2), ['retainedAttachmentIds', JSON.stringify(Array.from({ length: 5 }, (_, i) => id.slice(0, -1) + i))], ['files', new File(['x'], 'x.txt')]]), context())).status).toBe(400);
    const oversized = request([['markdown', 'x'.repeat(100 * 1024 * 1024 + 65537)]]);
    oversized.headers.set('content-length', '1');
    expect((await PATCH(oversized, context())).status).toBe(413);
    expect((await PATCH(new Request(url, { method: 'PATCH', headers: { origin: 'http://localhost:3200', 'content-type': 'multipart/form-data; boundary=missing' }, body: 'broken' }), context())).status).toBe(400);
    expect(mocked.editTicketMessage).not.toHaveBeenCalled();
  });
  it('deletes with a required JSON version and forbids unknown fields or oversized bodies', async () => {
    const result = await DELETE(deletion(), context());
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(await result.json()).toMatchObject({ markdown: null, version: 3 });
    expect(mocked.deleteTicketMessage).toHaveBeenCalledWith({ id: 'session-user', authVersion: 3 }, id, messageId, { expectedVersion: 2 });
    for (const data of [{}, { expectedVersion: '2' }, { expectedVersion: 0 }, { expectedVersion: 2, visibility: 'SHARED' }]) expect((await DELETE(deletion(data), context())).status).toBe(400);
    expect((await DELETE(deletion('x'.repeat(16385)), context())).status).toBe(413);
  });
  it('requires authentication, same origin, content type and rate limits for writes', async () => {
    const crossOrigin = request(); crossOrigin.headers.set('origin', 'http://evil.test');
    expect((await PATCH(crossOrigin, context())).status).toBe(403);
    const badDelete = deletion(); badDelete.headers.set('origin', 'http://evil.test');
    expect((await DELETE(badDelete, context())).status).toBe(403);
    expect((await PATCH(deletion(), context())).status).toBe(415);
    expect((await DELETE(request(), context())).status).toBe(415);
    mocked.limitAttempts.mockRejectedValueOnce(new DomainError(429, 'Tente depois.'));
    expect((await PATCH(request(), context())).status).toBe(429);
    mocked.currentUser.mockRejectedValue(new DomainError(401, 'Sessão encerrada.'));
    expect((await PATCH(request(), context())).status).toBe(401);
    expect((await DELETE(deletion(), context())).status).toBe(401);
    expect((await GET(new Request(url + '/revisions'), context())).status).toBe(401);
    expect(mocked.editTicketMessage).not.toHaveBeenCalled();
    expect(mocked.deleteTicketMessage).not.toHaveBeenCalled();
  });
  it('paginates revisions without cache and rejects duplicate or unknown query parameters', async () => {
    const response = await GET(new Request(url + '/revisions?page=2&pageSize=10'), context());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocked.listTicketMessageRevisions).toHaveBeenCalledWith({ id: 'session-user', authVersion: 3 }, id, messageId, { page: '2', pageSize: '10' });
    for (const query of ['page=1&page=2', 'pageSize=101', 'visibility=INTERNAL']) expect((await GET(new Request(url + '/revisions?' + query), context())).status).toBe(400);
  });
  it('preserves conflicts and authorization errors, masking database details', async () => {
    mocked.editTicketMessage.mockRejectedValueOnce(new DomainError(409, 'Versão alterada.'));
    expect((await PATCH(request(), context())).status).toBe(409);
    mocked.deleteTicketMessage.mockRejectedValueOnce(new DomainError(403, 'Somente o autor.'));
    expect((await DELETE(deletion(), context())).status).toBe(403);
    mocked.listTicketMessageRevisions.mockRejectedValueOnce(new DomainError(404, 'Mensagem não encontrada.'));
    expect((await GET(new Request(url + '/revisions'), context())).status).toBe(404);
    mocked.editTicketMessage.mockRejectedValueOnce(new Error('private database detail'));
    const failure = await PATCH(request(), context());
    expect(failure.status).toBe(500);
    expect(JSON.stringify(await failure.json())).not.toContain('private database detail');
  });
});
