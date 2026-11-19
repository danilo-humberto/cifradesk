import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainError } from '@cifradesk/core';
import { ticketMessagePageInput } from '@cifradesk/contracts/tickets';
const mocked = vi.hoisted(() => ({ currentUser: vi.fn(), limitAttempts: vi.fn(), createTicketMessage: vi.fn(), listTicketMessages: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@cifradesk/infrastructure', () => ({ createTicketMessage: mocked.createTicketMessage, listTicketMessages: mocked.listTicketMessages }));
vi.mock('@/lib/server/identity', () => ({ currentUser: mocked.currentUser, limitAttempts: mocked.limitAttempts }));
vi.mock('@/lib/server/tickets', async () => import('../../../lib/server/tickets'));
vi.mock('@/lib/server/http', async () => import('../../../lib/server/http'));
import { GET, POST } from './[id]/messages/route';

describe('conversation HTTP', () => {
  const id = '00000000-0000-4000-8000-000000000042';
  const context = () => ({ params: Promise.resolve({ id }) });
  function request(fields: Array<[string, string | File]> = [['markdown', '**Olá**'], ['visibility', 'SHARED']], origin = 'http://localhost:3200') {
    const form = new FormData();
    form.append('submissionId', id);
    for (const [key, value] of fields) form.append(key, value);
    return new Request(`http://localhost:3200/api/tickets/${id}/messages`, { method: 'POST', headers: { origin }, body: form });
  }
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3200');
    mocked.currentUser.mockResolvedValue({ id: 'session-user', authVersion: 3 });
    mocked.createTicketMessage.mockResolvedValue({ id: 'message' });
    mocked.listTicketMessages.mockImplementation(async (_actor, _id, query) => ({ ...ticketMessagePageInput.parse(query), total: 0, items: [] }));
  });
  afterEach(() => vi.unstubAllEnvs());
  it('takes the author from the session and returns a no-store 201 response', async () => {
    const response = await POST(request(), context());
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ id: 'message' });
    expect(mocked.createTicketMessage).toHaveBeenCalledWith({ id: 'session-user', authVersion: 3 }, id, { markdown: '**Olá**', visibility: 'SHARED', submissionId: id }, []);
    expect(mocked.limitAttempts).toHaveBeenCalledWith('ticket:message:session-user', 60);
  });
  it('requires same origin, multipart and valid authentication', async () => {
    expect((await POST(request(undefined, 'http://evil.test'), context())).status).toBe(403);
    const jsonRequest = new Request('http://localhost:3200/api/tickets/id/messages', { method: 'POST', headers: { origin: 'http://localhost:3200', 'content-type': 'application/json' }, body: '{}' });
    expect((await POST(jsonRequest, context())).status).toBe(415);
    mocked.currentUser.mockRejectedValue(new DomainError(401, 'Sessão encerrada.'));
    expect((await POST(request(), context())).status).toBe(401);
    expect((await GET(new Request('http://localhost:3200/api/tickets/id/messages'), context())).status).toBe(401);
    expect(mocked.createTicketMessage).not.toHaveBeenCalled();
  });
  it('accepts attachments alone and keeps bytes separate from the message metadata', async () => {
    expect((await POST(request([['markdown', ''], ['visibility', 'SHARED'], ['files', new File(['hello'], 'test.txt', { type: 'text/plain' })]]), context())).status).toBe(201);
    expect(mocked.createTicketMessage).toHaveBeenCalledWith({ id: 'session-user', authVersion: 3 }, id, { markdown: '', visibility: 'SHARED', submissionId: id }, [{ originalName: 'test.txt', mimeType: 'text/plain', bytes: Buffer.from('hello') }]);
  });
  it('rejects forged, duplicate, unknown and invalid fields before calling the service', async () => {
    for (const fields of [
      [['markdown', 'ok'], ['visibility', 'SHARED'], ['authorId', 'forged']],
      [['markdown', 'ok'], ['markdown', 'duplicate'], ['visibility', 'SHARED']],
      [['markdown', 'ok'], ['visibility', 'INTERNAL'], ['visibility', 'SHARED']],
      [['markdown', 'ok'], ['visibility', 'SHARED'], ['files', 'forged']],
      [['markdown', 'ok'], ['visibility', 'SHARED'], ['submissionId', id]],
      [['markdown', new File(['x'], 'x.txt')], ['visibility', 'SHARED']],
      [['markdown', ' \n '], ['visibility', 'SHARED']],
      [['markdown', 'x'.repeat(10001)], ['visibility', 'SHARED']],
      [['markdown', 'ok'], ['visibility', 'PUBLIC']],
      [['markdown', 'ok']]
    ] as Array<Array<[string, string | File]>>) expect((await POST(request(fields), context())).status).toBe(400);
    expect(mocked.createTicketMessage).not.toHaveBeenCalled();
  });
  it('bounds actual multipart bytes even with a forged content length and handles malformed data', async () => {
    const oversized = request([['markdown', 'a'.repeat(100 * 1024 * 1024 + 65537)], ['visibility', 'SHARED']]);
    oversized.headers.set('content-length', '1');
    expect((await POST(oversized, context())).status).toBe(413);
    const malformed = new Request('http://localhost:3200/api/tickets/id/messages', { method: 'POST', headers: { origin: 'http://localhost:3200', 'content-type': 'multipart/form-data; boundary=missing' }, body: 'broken' });
    expect((await POST(malformed, context())).status).toBe(400);
    expect(mocked.createTicketMessage).not.toHaveBeenCalled();
    expect((await POST(request([['markdown', '😀'.repeat(5000)], ['visibility', 'SHARED']]), context())).status).toBe(201);
  });
  it('requires an identifier and limits file count and individual size', async () => {
    const missing = new FormData();
    missing.set('markdown', 'hello'); missing.set('visibility', 'SHARED');
    expect((await POST(new Request('http://localhost:3200/api/tickets/id/messages', { method: 'POST', headers: { origin: 'http://localhost:3200' }, body: missing }), context())).status).toBe(400);
    expect((await POST(request([['markdown', ''], ['visibility', 'SHARED'], ...Array.from({ length: 6 }, (): [string, File] => ['files', new File(['x'], 'x.txt')])]), context())).status).toBe(400);
    expect((await POST(request([['markdown', ''], ['visibility', 'SHARED'], ['files', new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'big.txt')]]), context())).status).toBe(400);
    expect(mocked.createTicketMessage).not.toHaveBeenCalled();
  });
  it('parses pagination, rejects duplicate parameters and does not cache conversations', async () => {
    const response = await GET(new Request('http://localhost:3200/api/tickets/id/messages?page=2&pageSize=10'), context());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocked.listTicketMessages).toHaveBeenCalledWith({ id: 'session-user', authVersion: 3 }, id, { page: '2', pageSize: '10' });
    expect(await response.json()).toMatchObject({ page: 2, pageSize: 10 });
    for (const query of ['page=1&page=2', 'pageSize=101', 'visibility=INTERNAL']) expect((await GET(new Request('http://localhost:3200/api/tickets/id/messages?' + query), context())).status).toBe(400);
  });
  it('preserves authorization and rate-limit errors without exposing internal failures', async () => {
    mocked.limitAttempts.mockRejectedValueOnce(new DomainError(429, 'Tente depois.'));
    expect((await POST(request(), context())).status).toBe(429);
    expect(mocked.createTicketMessage).not.toHaveBeenCalled();
    mocked.createTicketMessage.mockRejectedValueOnce(new DomainError(403, 'Sem vínculo.'));
    expect((await POST(request(), context())).status).toBe(403);
    mocked.listTicketMessages.mockRejectedValueOnce(new DomainError(404, 'Chamado não encontrado.'));
    expect((await GET(new Request('http://localhost:3200/api/tickets/id/messages'), context())).status).toBe(404);
    mocked.createTicketMessage.mockRejectedValueOnce(new Error('private database detail'));
    const failure = await POST(request(), context());
    expect(failure.status).toBe(500);
    expect(JSON.stringify(await failure.json())).not.toContain('private database detail');
  });
});
