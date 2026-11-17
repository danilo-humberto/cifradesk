import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { database } from '@cifradesk/database';
import { createTicketMessage, listTicketMessages } from './ticket-messages';
import { listTicketAttachments } from './ticket-queries';
import { cleanupAttachments, downloadAttachment, uploadAttachments } from './ticket-attachments';
import { setMembership } from './identity';
import { operateTicket } from './ticket-operations';
import type { AttachmentStorage } from './storage';

describe.skipIf(process.env.TICKET_MESSAGES_TEST_DATABASE !== '1')('atomic message attachments PostgreSQL', () => {
  let db: ReturnType<typeof database>;
  const requester = { id: randomUUID(), authVersion: 1 }, member = { id: randomUUID(), authVersion: 1 }, admin = { id: randomUUID(), authVersion: 1 };
  const sector = randomUUID();
  const file = (text = 'synthetic', originalName = 'test.txt') => ({ originalName, mimeType: 'text/plain', bytes: Buffer.from(text) });
  const input = (markdown = 'Mensagem', visibility = 'SHARED') => ({ markdown, visibility, submissionId: randomUUID() });
  const ticket = () => db.ticket.create({ data: { title: 'Anexos sintéticos', description: 'Descrição sintética', requestedFor: 'SELF', requesterName: 'Solicitante', createdById: requester.id, originDepartmentId: sector, originDepartmentName: 'Setor', departmentId: sector } });
  function storage() {
    const objects = new Map<string, Buffer>();
    return { objects, put: vi.fn(async (key: string, bytes: Buffer) => { objects.set(key, bytes); }), get: vi.fn(async (key: string) => objects.get(key)!), remove: vi.fn(async (key: string) => { objects.delete(key); }) } satisfies AttachmentStorage & { objects: Map<string, Buffer> };
  }
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (url.hostname !== 'postgres' || !/^\/messages42_test_[a-f0-9]+$/.test(url.pathname) || url.username !== url.pathname.slice(1)) throw new Error('Unsafe test database');
    db = database();
    expect(await db.$queryRaw`SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user`).toEqual([{ rolsuper: false, rolcreatedb: false, rolcreaterole: false }]);
    for (const actor of [requester, member, admin]) await db.user.create({ data: { ...actor, name: 'Sintético', email: actor.id + '@example.test', status: 'ACTIVE', isAdmin: actor === admin } });
    await db.department.create({ data: { id: sector, name: 'Arquivos' } });
    await db.departmentMembership.create({ data: { userId: member.id, departmentId: sector } });
  });
  afterAll(async () => { await db?.$disconnect(); });

  it('publishes text/files or files alone with an immutable snapshot, and retries without duplicating', async () => {
    for (const markdown of ['Texto', '']) {
      const t = await ticket(), body = input(markdown), s = storage();
      const message = await createTicketMessage(requester, t.id, body, [file()], s);
      expect(message.attachments).toHaveLength(1);
      expect(await createTicketMessage(requester, t.id, body, [file()], s)).toEqual(message);
      expect(s.put).toHaveBeenCalledTimes(1);
      expect(await db.ticketMessage.count({ where: { ticketId: t.id } })).toBe(1);
      expect(await db.outboxEvent.count({ where: { ticketId: t.id } })).toBe(1);
      expect(await db.ticketMessageRevision.findFirstOrThrow({ where: { messageId: message.id } })).toMatchObject({ attachments: [{ id: message.attachments[0]!.id, originalName: 'test.txt' }] });
      expect((await downloadAttachment(requester, t.id, message.attachments[0]!.id, s)).bytes).toEqual(file().bytes);
      // A different author has a separate key namespace.
      await expect(createTicketMessage(member, t.id, body, [file()], s)).resolves.toBeDefined();
      await expect(createTicketMessage(requester, t.id, { ...body, markdown: 'Mudou' }, [file()], s)).rejects.toMatchObject({ status: 409 });
      await expect(createTicketMessage(requester, t.id, body, [file('changed')], s)).rejects.toMatchObject({ status: 409 });
      await expect(createTicketMessage(requester, t.id, body, [file('synthetic', 'renamed.txt')], s)).rejects.toMatchObject({ status: 409 });
    }
  });

  it('rejects invalid content, a sixth file, oversized files and an empty message before storage', async () => {
    const t = await ticket(), s = storage();
    for (const files of [[{ ...file(), mimeType: 'application/pdf', originalName: 'fake.pdf' }], Array.from({ length: 6 }, () => file()), [{ ...file(), bytes: Buffer.alloc(20 * 1024 * 1024 + 1, 65) }], []]) {
      await expect(createTicketMessage(requester, t.id, input(''), files, s)).rejects.toThrow();
    }
    expect(s.put).not.toHaveBeenCalled();
    expect(await db.ticketAttachment.count({ where: { ticketId: t.id } })).toBe(0);
    expect(await db.ticketMessage.count({ where: { ticketId: t.id } })).toBe(0);
  });

  it('accepts exactly five files and the 20 MB boundary, and enforces submission database constraints', async () => {
    const t = await ticket(), other = await ticket(), body = input(), s = storage();
    const files = Array.from({ length: 5 }, () => file());
    files[0] = { ...file(), bytes: Buffer.alloc(20 * 1024 * 1024, 65) };
    const m = await createTicketMessage(requester, t.id, body, files, s);
    expect(m.attachments).toHaveLength(5);
    const submission = await db.messageSubmission.findFirstOrThrow({ where: { ticketId: t.id } });
    await expect(db.messageSubmission.create({ data: { ticketId: t.id, authorId: requester.id, clientId: body.submissionId, fingerprint: submission.fingerprint } })).rejects.toMatchObject({ code: 'P2002' });
    await expect(db.ticketAttachment.create({ data: { ticketId: other.id, submissionId: submission.id, uploadedById: requester.id, originalName: 'forged.txt', mimeType: 'text/plain', size: 1, objectKey: randomUUID() } })).rejects.toThrow();
    const unlinked = await db.ticketMessage.create({ data: { ticketId: t.id, authorId: requester.id, markdown: 'Sintético', visibility: 'SHARED' } });
    await expect(db.messageSubmission.create({ data: { ticketId: other.id, authorId: requester.id, clientId: randomUUID(), fingerprint: submission.fingerprint, messageId: unlinked.id } })).rejects.toThrow();
    await expect(db.messageSubmission.create({ data: { ticketId: other.id, authorId: requester.id, clientId: randomUUID(), fingerprint: 'invalid' } })).rejects.toThrow();
    expect((await listTicketAttachments(requester, t.id, { pageSize: 1 })).total).toBe(5);
  });

  it('keeps pending uploads invisible, rejects simultaneous retries and reserves the 200 MB quota', async () => {
    const t = await ticket(), body = input(), s = storage();
    await db.ticketAttachment.createMany({ data: Array.from({ length: 10 }, (_, i) => ({ ticketId: t.id, uploadedById: requester.id, originalName: 'existing.txt', mimeType: 'text/plain', size: 20 * 1024 * 1024 - (i === 0 ? file().bytes.length : 0), objectKey: randomUUID(), status: 'AVAILABLE' as const })) });
    s.put.mockImplementationOnce(async (key, bytes) => {
      expect((await listTicketMessages(requester, t.id, {})).total).toBe(0);
      expect((await listTicketAttachments(requester, t.id, {})).total).toBe(10);
      await expect(createTicketMessage(requester, t.id, body, [file()], s)).rejects.toMatchObject({ status: 409 });
      await expect(createTicketMessage(requester, t.id, input(), [file()], s)).rejects.toMatchObject({ status: 409 });
      await expect(uploadAttachments(requester, t.id, [file()], s)).rejects.toMatchObject({ status: 409 });
      s.objects.set(key, bytes);
    });
    await createTicketMessage(requester, t.id, body, [file()], s);
    expect(await db.ticketMessage.count({ where: { ticketId: t.id } })).toBe(1);
  });

  it('isolates internal files, counts and identifiers on legacy routes and blocks removed content', async () => {
    const t = await ticket(), s = storage(), body = input('Interno', 'INTERNAL');
    const m = await createTicketMessage(member, t.id, body, [file('secret', 'secret.txt')], s);
    const id = m.attachments[0]!.id;
    expect(await listTicketAttachments(requester, t.id, {})).toMatchObject({ items: [], total: 0 });
    await expect(downloadAttachment(requester, t.id, id, s)).rejects.toMatchObject({ status: 404 });
    await expect(downloadAttachment(admin, t.id, id, s)).rejects.toMatchObject({ status: 404 });
    expect(s.get).not.toHaveBeenCalled();
    expect((await listTicketAttachments(member, t.id, {})).total).toBe(1);
    await db.ticketAttachment.update({ where: { id }, data: { removedAt: new Date() } });
    await expect(downloadAttachment(member, t.id, id, s)).rejects.toMatchObject({ status: 404 });
    expect((await listTicketAttachments(member, t.id, {})).total).toBe(0);
    expect((await listTicketMessages(member, t.id, {})).items[0]!.attachments).toEqual([]);
    await db.ticketAttachment.update({ where: { id }, data: { removedAt: null } });
    await db.ticketMessage.update({ where: { id: m.id }, data: { deletedAt: new Date() } });
    await expect(downloadAttachment(member, t.id, id, s)).rejects.toMatchObject({ status: 404 });
    expect((await listTicketMessages(member, t.id, {})).items[0]).toMatchObject({ markdown: null, attachments: [] });
    expect(await createTicketMessage(member, t.id, body, [file('secret', 'secret.txt')], s)).toMatchObject({ markdown: null, attachments: [] });
  });

  it('rechecks membership during upload, download and replay without authorship privilege', async () => {
    const t = await ticket(), s = storage();
    s.put.mockImplementationOnce(async () => { await setMembership(admin.id, sector, member.id, false); });
    try {
      await expect(createTicketMessage(member, t.id, input('', 'INTERNAL'), [file()], s)).rejects.toMatchObject({ status: 404 });
      expect((await listTicketMessages(requester, t.id, {})).total).toBe(0);
    } finally { await setMembership(admin.id, sector, member.id, true); }
    const body = input('', 'INTERNAL');
    const m = await createTicketMessage(member, t.id, body, [file()], s);
    s.get.mockImplementationOnce(async () => { await setMembership(admin.id, sector, member.id, false); return file().bytes; });
    try {
      await expect(downloadAttachment(member, t.id, m.attachments[0]!.id, s)).rejects.toMatchObject({ status: 404 });
      await expect(createTicketMessage(member, t.id, body, [file()], s)).rejects.toMatchObject({ status: 404 });
    } finally { await setMembership(admin.id, sector, member.id, true); }
  });

  it('recovers partial failures after the grace period and permits a safe retry', async () => {
    const t = await ticket(), s = storage(), body = input();
    s.put.mockImplementationOnce(async (key, bytes) => { s.objects.set(key, bytes); }).mockRejectedValueOnce(new Error('synthetic PUT failure'));
    await expect(createTicketMessage(requester, t.id, body, [file(), file('second')], s)).rejects.toMatchObject({ status: 503 });
    expect(await db.ticketMessage.count({ where: { ticketId: t.id } })).toBe(0);
    expect((await listTicketAttachments(requester, t.id, {})).total).toBe(0);
    expect(await db.ticketAttachment.count({ where: { ticketId: t.id, status: 'PENDING_DELETION' } })).toBe(2);
    await cleanupAttachments(s);
    expect(await db.ticketAttachment.count({ where: { ticketId: t.id, status: 'FAILED' } })).toBe(0);
    await db.ticketAttachment.updateMany({ where: { ticketId: t.id }, data: { updatedAt: new Date(Date.now() - 31 * 60000) } });
    await cleanupAttachments(s);
    expect(await db.ticketAttachment.count({ where: { ticketId: t.id, status: 'FAILED' } })).toBe(2);
    await createTicketMessage(requester, t.id, body, [file(), file('second')], s);
    expect((await listTicketMessages(requester, t.id, {})).total).toBe(1);
  });

  it('fences an expired upload after cleanup and never deletes the successful retry', async () => {
    const t = await ticket(), s = storage(), body = input();
    let publishedId = '';
    s.put.mockImplementationOnce(async (key, bytes) => {
      s.objects.set(key, bytes); // Crash point: object exists, publication does not.
      const old = new Date(Date.now() - 31 * 60000);
      await db.ticketAttachment.updateMany({ where: { ticketId: t.id }, data: { updatedAt: old } });
      await db.messageSubmission.updateMany({ where: { ticketId: t.id }, data: { updatedAt: old } });
      expect((await listTicketMessages(requester, t.id, {})).total).toBe(0);
      await cleanupAttachments(s);
      expect(s.objects.size).toBe(0);
      publishedId = (await createTicketMessage(requester, t.id, body, [file()], s)).id;
    });
    await expect(createTicketMessage(requester, t.id, body, [file()], s)).rejects.toMatchObject({ status: 409 });
    expect(s.objects.size).toBe(1);
    expect((await listTicketMessages(requester, t.id, {})).items.map(row => row.id)).toEqual([publishedId]);
    expect((await createTicketMessage(requester, t.id, body, [file()], s)).id).toBe(publishedId);
  });

  it('rolls back publication when outbox fails, including attachment states and the initial revision', async () => {
    const t = await ticket(), s = storage(), body = input();
    await db.$executeRawUnsafe(`CREATE FUNCTION fail_outbox43() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER fail_outbox43 BEFORE INSERT ON "OutboxEvent" FOR EACH ROW EXECUTE FUNCTION fail_outbox43()`);
    try {
      await expect(createTicketMessage(requester, t.id, body, [file()], s)).rejects.toMatchObject({ status: 503 });
      expect(await db.ticketMessage.count({ where: { ticketId: t.id } })).toBe(0);
      expect(await db.ticketMessageRevision.count({ where: { message: { ticketId: t.id } } })).toBe(0);
      expect(await db.ticketActivity.count({ where: { ticketId: t.id } })).toBe(0);
      expect(await db.ticketAttachment.count({ where: { ticketId: t.id, status: 'AVAILABLE' } })).toBe(0);
      expect((await db.messageSubmission.findFirstOrThrow({ where: { ticketId: t.id } })).messageId).toBeNull();
    } finally { await db.$executeRawUnsafe('DROP TRIGGER fail_outbox43 ON "OutboxEvent"'); }
    await createTicketMessage(requester, t.id, body, [file()], s);
    expect(await db.ticketMessage.count({ where: { ticketId: t.id } })).toBe(1);
  });

  it('bounds crash recovery to 100 reservations and retains quota when deletion fails', async () => {
    const t = await ticket(), s = storage();
    await db.ticketAttachment.createMany({ data: Array.from({ length: 101 }, () => ({ ticketId: t.id, uploadedById: requester.id, originalName: 'orphan.txt', mimeType: 'text/plain', size: 1, objectKey: randomUUID(), status: 'PENDING_UPLOAD' as const, updatedAt: new Date(Date.now() - 31 * 60000) })) });
    s.remove.mockRejectedValueOnce(new Error('synthetic DELETE failure'));
    expect((await cleanupAttachments(s)).processed).toBe(100);
    expect(await db.ticketAttachment.count({ where: { ticketId: t.id, status: 'FAILED' } })).toBe(99);
    expect(await db.ticketAttachment.count({ where: { ticketId: t.id, status: { not: 'FAILED' } } })).toBe(2);
    await db.ticketAttachment.updateMany({ where: { ticketId: t.id, status: { not: 'FAILED' } }, data: { updatedAt: new Date(Date.now() - 31 * 60000) } });
    expect((await cleanupAttachments(s)).processed).toBe(2);
    expect(await db.ticketAttachment.count({ where: { ticketId: t.id, status: 'FAILED' } })).toBe(101);
  });

  it('rechecks stale sessions during IO and follows the current sector for internal downloads', async () => {
    const t = await ticket(), s = storage();
    s.put.mockImplementationOnce(async () => { await db.user.update({ where: { id: requester.id }, data: { authVersion: 2 } }); });
    try { await expect(createTicketMessage(requester, t.id, input(), [file()], s)).rejects.toMatchObject({ status: 401 }); }
    finally { await db.user.update({ where: { id: requester.id }, data: { authVersion: 1 } }); }
    const next = await db.department.create({ data: { name: 'Novo setor sintético' } });
    const body = input('Interno', 'INTERNAL');
    const m = await createTicketMessage(member, t.id, body, [file()], s);
    s.get.mockImplementationOnce(async () => {
      await operateTicket(member, t.id, 'transfer', { expectedVersion: 1, departmentId: next.id, reason: 'Transferência sintética' });
      return file().bytes;
    });
    await expect(downloadAttachment(member, t.id, m.attachments[0]!.id, s)).rejects.toMatchObject({ status: 404 });
    expect((await listTicketAttachments(requester, t.id, {})).total).toBe(0);
    await setMembership(admin.id, next.id, requester.id, true);
    expect((await downloadAttachment(requester, t.id, m.attachments[0]!.id, s)).bytes).toEqual(file().bytes);
    await expect(createTicketMessage(member, t.id, body, [file()], s)).rejects.toMatchObject({ status: 404 });
  });
});
