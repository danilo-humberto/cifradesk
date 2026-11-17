import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@cifradesk/infrastructure', () => ({}));
import { attachmentFiles } from './tickets';
import { body, sameOrigin } from './http';
describe('ticket HTTP payloads', () => {
  beforeEach(() => { vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3200'); });
  it('requires the exact content type and same origin', () => {
    for (const origin of ['http://evil.test', 'null', '']) expect(() => sameOrigin(new Request('http://localhost:3200/api/tickets', { headers: { origin, 'content-type': 'application/json' } }))).toThrow();
    expect(() => sameOrigin(new Request('http://localhost:3200/api/tickets', { headers: { origin: 'http://localhost:3200', 'content-type': 'application/json-evil' } }))).toThrow();
  });
  it('supports maximum Unicode descriptions without trusting content length', async () => {
    const value = { description: '😀'.repeat(5000) };
    expect(await body(new Request('http://local', { method: 'POST', body: JSON.stringify(value) }), 64 * 1024)).toEqual(value);
    await expect(body(new Request('http://local', { method: 'POST', body: 'x'.repeat(100), headers: { 'content-length': '1' } }), 50)).rejects.toMatchObject({ status: 413 });
  });
  it('reads multipart files with names, types and bytes', async () => {
    const form = new FormData(); form.append('files', new File(['ajuda'], 'ajuda.txt', { type: 'text/plain' }));
    expect(await attachmentFiles(new Request('http://local', { method: 'POST', body: form }))).toEqual([{ originalName: 'ajuda.txt', mimeType: 'text/plain', bytes: Buffer.from('ajuda') }]);
  });
  it('rejects unknown fields, strings instead of files and batches larger than five', async () => {
    for (const mode of ['unknown', 'string', 'six']) {
      const form = new FormData();
      if (mode === 'unknown') form.append('createdById', 'forged');
      if (mode === 'string') form.append('files', 'not a file');
      if (mode === 'six') for (let i = 0; i < 6; i++) form.append('files', new File(['a'], 'a.txt', { type: 'text/plain' }));
      await expect(attachmentFiles(new Request('http://local', { method: 'POST', body: form }))).rejects.toMatchObject({ status: 400 });
    }
  });
});
