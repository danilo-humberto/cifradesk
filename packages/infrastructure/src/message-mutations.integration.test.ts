import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { database } from '@cifradesk/database';
import { createTicketMessage, deleteTicketMessage, editTicketMessage, listTicketMessageRevisions, listTicketMessages } from './ticket-messages';
import { cleanupAttachments, downloadAttachment, uploadAttachments } from './ticket-attachments';
import { listTicketActivities, listTicketAttachments } from './ticket-queries';
import { setMembership } from './identity';
import { operateTicket } from './ticket-operations';
import type { AttachmentStorage } from './storage';

describe.skipIf(process.env.TICKET_MESSAGES_TEST_DATABASE !== '1')('message edits and deletion PostgreSQL', () => {
  let db: ReturnType<typeof database>;
  const requester = { id: randomUUID(), authVersion: 1 }, member = { id: randomUUID(), authVersion: 1 };
  const other = { id: randomUUID(), authVersion: 1 }, admin = { id: randomUUID(), authVersion: 1 };
  const sector = randomUUID();
  const file = (text = 'synthetic', originalName = 'test.txt') => ({ originalName, mimeType: 'text/plain', bytes: Buffer.from(text) });
  const body = (markdown = 'Original', visibility = 'SHARED') => ({ markdown, visibility, submissionId: randomUUID() });
  const edit = (expectedVersion = 1, markdown = 'Corrigida', retainedAttachmentIds: string[] = []) => ({ expectedVersion, markdown, retainedAttachmentIds });
  const ticket = () => db.ticket.create({ data: { title: 'Edição sintética', description: 'Descrição sintética', requestedFor: 'SELF', requesterName: 'Solicitante', createdById: requester.id, originDepartmentId: sector, originDepartmentName: 'Setor', departmentId: sector } });
  function storage() {
    const objects = new Map<string, Buffer>();
    return { objects, put: vi.fn(async (key: string, bytes: Buffer) => { objects.set(key, bytes); }), get: vi.fn(async (key: string) => objects.get(key)!), remove: vi.fn(async (key: string) => { objects.delete(key); }) } satisfies AttachmentStorage & { objects: Map<string, Buffer> };
  }
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (url.hostname !== 'postgres' || !/^\/messages42_test_[a-f0-9]+$/.test(url.pathname) || url.username !== url.pathname.slice(1)) throw new Error('Unsafe test database');
    db = database();
    expect(await db.$queryRaw`SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user`).toEqual([{ rolsuper: false, rolcreatedb: false, rolcreaterole: false }]);
    for (const actor of [requester, member, other, admin]) await db.user.create({ data: { ...actor, name: 'Sintético', email: actor.id + '@example.test', status: 'ACTIVE', isAdmin: actor === admin } });
    await db.department.create({ data: { id: sector, name: 'Edições' } });
    await db.departmentMembership.createMany({ data: [member, other].map(actor => ({ userId: actor.id, departmentId: sector })) });
  });
  afterAll(async () => { await db?.$disconnect(); });

  it('edits text and attachment composition, keeps immutable names and revokes old downloads without releasing quota', async () => {
    const t = await ticket(), s = storage();
    const m = await createTicketMessage(requester, t.id, body(), [file('old', 'old.txt'), file('keep', 'keep.txt')], s);
    const removed = m.attachments.find(a => a.originalName === 'old.txt')!.id;
    const kept = m.attachments.find(a => a.originalName === 'keep.txt')!.id;
    const updated = await editTicketMessage(requester, t.id, m.id, edit(1, '**Corrigida**', [kept]), [file('new', 'new.txt')], s);
    expect(updated).toMatchObject({ version: 2, markdown: '**Corrigida**', canEdit: true, canDelete: true, canViewRevisions: true });
    expect(updated.attachments.map(a => a.originalName).sort()).toEqual(['keep.txt', 'new.txt']);
    const revisions = await listTicketMessageRevisions(member, t.id, m.id, { pageSize: 1 });
    expect(revisions).toMatchObject({ total: 2, page: 1, pageSize: 1, items: [{ version: 2, markdown: '**Corrigida**' }] });
    const initial = await listTicketMessageRevisions(requester, t.id, m.id, { page: 2, pageSize: 1 });
    expect(initial.items[0]).toMatchObject({ version: 1, markdown: 'Original', attachments: expect.arrayContaining([{ id: removed, originalName: 'old.txt', available: false }, { id: kept, originalName: 'keep.txt', available: true }]) });
    await expect(downloadAttachment(member, t.id, removed, s)).rejects.toMatchObject({ status: 404 });
    expect((await downloadAttachment(member, t.id, kept, s)).bytes).toEqual(file('keep').bytes);
    expect((await listTicketAttachments(requester, t.id, {})).total).toBe(2);
    expect((await db.ticketAttachment.aggregate({ where: { ticketId: t.id, status: { not: 'FAILED' } }, _sum: { size: true } }))._sum.size).toBe(10);
    expect(s.remove).not.toHaveBeenCalled();
    expect(JSON.stringify(revisions)).not.toContain('objectKey');
  });

  it('records nothing for an unchanged edit, including reordered retained identifiers', async () => {
    const t = await ticket(), s = storage();
    const m = await createTicketMessage(requester, t.id, body(), [file(), file('second')], s);
    const result = await editTicketMessage(requester, t.id, m.id, edit(1, 'Original', m.attachments.map(a => a.id).reverse()), [], s);
    expect(result).toEqual(m);
    expect(await db.ticketMessageRevision.count({ where: { messageId: m.id } })).toBe(1);
    expect(await db.ticketActivity.count({ where: { ticketId: t.id } })).toBe(1);
    expect(await db.outboxEvent.count({ where: { ticketId: t.id } })).toBe(1);
    expect(s.put).toHaveBeenCalledTimes(2);
  });

  it('limits author actions and hides internal versions from requesters, unrelated admins and manipulated ticket ids', async () => {
    const t = await ticket(), unrelated = await ticket();
    const m = await createTicketMessage(member, t.id, body('Segredo', 'INTERNAL'));
    for (const actor of [requester, admin]) {
      await expect(listTicketMessageRevisions(actor, t.id, m.id, {})).rejects.toMatchObject({ status: 404 });
      await expect(editTicketMessage(actor, t.id, m.id, edit())).rejects.toMatchObject({ status: 404 });
      await expect(deleteTicketMessage(actor, t.id, m.id, { expectedVersion: 1 })).rejects.toMatchObject({ status: 404 });
    }
    expect((await listTicketMessages(other, t.id, {})).items[0]).toMatchObject({ canEdit: false, canDelete: false, canViewRevisions: true });
    await expect(editTicketMessage(other, t.id, m.id, edit())).rejects.toMatchObject({ status: 403 });
    await expect(deleteTicketMessage(other, t.id, m.id, { expectedVersion: 1 })).rejects.toMatchObject({ status: 403 });
    for (const id of [unrelated.id, randomUUID()]) {
      await expect(listTicketMessageRevisions(member, id, m.id, {})).rejects.toMatchObject({ status: 404 });
      await expect(editTicketMessage(member, id, m.id, edit())).rejects.toMatchObject({ status: 404 });
      await expect(deleteTicketMessage(member, id, m.id, { expectedVersion: 1 })).rejects.toMatchObject({ status: 404 });
    }
  });

  it('requires expected versions, immutable visibility, valid retained ids and nonempty final content before storage', async () => {
    const t = await ticket(), s = storage();
    const m = await createTicketMessage(requester, t.id, body(), [file()], s);
    const foreign = await createTicketMessage(requester, t.id, body(), [file()], s);
    const retained = m.attachments[0]!.id;
    for (const data of [{ markdown: 'missing', retainedAttachmentIds: [] }, { ...edit(), expectedVersion: 0 }, { ...edit(), visibility: 'INTERNAL' }, { ...edit(), authorId: member.id }, edit(1, ' \n '), edit(1, 'x'.repeat(10001)), edit(1, 'ok', [retained, retained]), edit(1, 'ok', [foreign.attachments[0]!.id]), edit(1, 'ok', [randomUUID()])]) await expect(editTicketMessage(requester, t.id, m.id, data, [], s)).rejects.toThrow();
    await expect(deleteTicketMessage(requester, t.id, m.id, {})).rejects.toThrow();
    for (const query of [{ page: 0 }, { pageSize: 101 }, { visibility: 'INTERNAL' }]) await expect(listTicketMessageRevisions(requester, t.id, m.id, query)).rejects.toThrow();
    const fileOnly = await editTicketMessage(requester, t.id, m.id, edit(1, '', [retained]));
    expect(fileOnly).toMatchObject({ markdown: '', version: 2 });
    await editTicketMessage(requester, t.id, m.id, edit(2, 'Text only'));
    await expect(editTicketMessage(requester, t.id, m.id, edit(3, 'restore', [retained]), [], s)).rejects.toMatchObject({ status: 400 });
    expect(s.put).toHaveBeenCalledTimes(2);
  });

  it('enforces five active files, five new files, content, size and retained-byte quota', async () => {
    const t = await ticket(), s = storage();
    const m = await createTicketMessage(requester, t.id, body(), Array.from({ length: 5 }, () => file()), s);
    for (const files of [[file()], Array.from({ length: 6 }, () => file()), [{ ...file(), mimeType: 'application/pdf' }], [{ ...file(), bytes: Buffer.alloc(20 * 1024 * 1024 + 1, 65) }]]) await expect(editTicketMessage(requester, t.id, m.id, edit(1, 'ok', m.attachments.map(a => a.id)), files, s)).rejects.toThrow();
    await editTicketMessage(requester, t.id, m.id, edit());
    await db.ticketAttachment.createMany({ data: Array.from({ length: 10 }, (_, i) => ({ ticketId: t.id, uploadedById: requester.id, originalName: 'quota.txt', mimeType: 'text/plain', size: 20 * 1024 * 1024 - (i === 0 ? 5 * file().bytes.length : 0), objectKey: randomUUID(), status: 'AVAILABLE' as const })) });
    await expect(editTicketMessage(requester, t.id, m.id, edit(2), [file()], s)).rejects.toMatchObject({ status: 409 });
    expect(s.put).toHaveBeenCalledTimes(5);
  });

  it('preserves the previous publication during partial upload failures and recovers reservations', async () => {
    const t = await ticket(), s = storage();
    const m = await createTicketMessage(requester, t.id, body(), [file('old')], s);
    s.put.mockImplementationOnce(async (key, bytes) => {
      s.objects.set(key, bytes);
      expect((await listTicketMessages(requester, t.id, {})).items[0]).toEqual(m);
      expect((await listTicketAttachments(requester, t.id, {})).total).toBe(1);
    }).mockRejectedValueOnce(new Error('synthetic PUT failure'));
    await expect(editTicketMessage(requester, t.id, m.id, edit(), [file(), file('second')], s)).rejects.toMatchObject({ status: 503 });
    expect((await listTicketMessages(requester, t.id, {})).items[0]).toEqual(m);
    expect((await listTicketMessageRevisions(requester, t.id, m.id, {})).total).toBe(1);
    expect(await db.ticketAttachment.count({ where: { ticketId: t.id, status: 'PENDING_DELETION' } })).toBe(2);
    await db.ticketAttachment.updateMany({ where: { ticketId: t.id, status: 'PENDING_DELETION' }, data: { updatedAt: new Date(Date.now() - 31 * 60000) } });
    await cleanupAttachments(s);
    expect((await downloadAttachment(requester, t.id, m.attachments[0]!.id, s)).bytes).toEqual(file('old').bytes);
    expect(await db.ticketAttachment.count({ where: { ticketId: t.id, status: 'FAILED' } })).toBe(2);
  });

  it('rolls back edits and deletes when event persistence fails, retaining previous text, files and revisions', async () => {
    const t = await ticket(), s = storage();
    const m = await createTicketMessage(requester, t.id, body(), [file()], s);
    await db.$executeRawUnsafe(`CREATE FUNCTION fail_outbox44() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER fail_outbox44 BEFORE INSERT ON "OutboxEvent" FOR EACH ROW EXECUTE FUNCTION fail_outbox44()`);
    try {
      await expect(editTicketMessage(requester, t.id, m.id, edit(), [file('new')], s)).rejects.toMatchObject({ status: 503 });
      await expect(deleteTicketMessage(requester, t.id, m.id, { expectedVersion: 1 })).rejects.toThrow();
      expect((await listTicketMessages(requester, t.id, {})).items[0]).toEqual(m);
      expect((await listTicketMessageRevisions(requester, t.id, m.id, {})).total).toBe(1);
      expect(await db.ticketActivity.count({ where: { ticketId: t.id } })).toBe(1);
    } finally { await db.$executeRawUnsafe('DROP TRIGGER fail_outbox44 ON "OutboxEvent"'); }
  });

  it('allows one of two concurrent edits and rejects stale no-op or delete requests', async () => {
    const t = await ticket(), m = await createTicketMessage(requester, t.id, body());
    const results = await Promise.allSettled([editTicketMessage(requester, t.id, m.id, edit(1, 'A')), editTicketMessage(requester, t.id, m.id, edit(1, 'B'))]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(r => r.status === 'rejected')).toMatchObject({ reason: { status: 409 } });
    const current = (await listTicketMessages(requester, t.id, {})).items[0]!;
    await expect(editTicketMessage(requester, t.id, m.id, edit(1, current.markdown!))).rejects.toMatchObject({ status: 409 });
    await expect(deleteTicketMessage(requester, t.id, m.id, { expectedVersion: 1 })).rejects.toMatchObject({ status: 409 });
    expect((await listTicketMessageRevisions(requester, t.id, m.id, {})).total).toBe(2);
  });

  it('fences edits after concurrent deletion and returns only a tombstone even on original submission replay', async () => {
    const t = await ticket(), s = storage(), input = body('Retido');
    const m = await createTicketMessage(requester, t.id, input, [file('secret', 'secret.txt')], s);
    s.put.mockImplementationOnce(async () => { await deleteTicketMessage(requester, t.id, m.id, { expectedVersion: 1 }); });
    await expect(editTicketMessage(requester, t.id, m.id, edit(), [file('new')], s)).rejects.toMatchObject({ status: 404 });
    const marker = (await listTicketMessages(requester, t.id, {})).items[0]!;
    expect(marker).toMatchObject({ id: m.id, version: 2, markdown: null, attachments: [], canEdit: false, canDelete: false, canViewRevisions: false });
    expect(marker.deletedAt).not.toBeNull();
    await expect(listTicketMessageRevisions(requester, t.id, m.id, {})).rejects.toMatchObject({ status: 404 });
    await expect(deleteTicketMessage(requester, t.id, m.id, { expectedVersion: 2 })).rejects.toMatchObject({ status: 404 });
    expect(await createTicketMessage(requester, t.id, input, [file('secret', 'secret.txt')], s)).toEqual(marker);
    expect((await listTicketAttachments(requester, t.id, {})).total).toBe(0);
    expect(await db.ticketMessageRevision.count({ where: { messageId: m.id } })).toBe(1);
    expect((await db.ticketAttachment.findUniqueOrThrow({ where: { id: m.attachments[0]!.id } })).status).toBe('AVAILABLE');
  });

  it('blocks a download when deletion or removal commits while storage is returning bytes', async () => {
    for (const action of ['delete', 'remove']) {
      const t = await ticket(), s = storage();
      const m = await createTicketMessage(requester, t.id, body(), [file()], s);
      s.get.mockImplementationOnce(async () => {
        if (action === 'delete') await deleteTicketMessage(requester, t.id, m.id, { expectedVersion: 1 });
        else await editTicketMessage(requester, t.id, m.id, edit());
        return file().bytes;
      });
      await expect(downloadAttachment(requester, t.id, m.attachments[0]!.id, s)).rejects.toMatchObject({ status: 404 });
    }
  });

  it('rechecks membership and sessions during edit uploads, even when authors retain requester access', async () => {
    const t = await ticket(), s = storage();
    await setMembership(admin.id, sector, requester.id, true);
    const m = await createTicketMessage(requester, t.id, body('Interno', 'INTERNAL'));
    s.put.mockImplementationOnce(async () => { await setMembership(admin.id, sector, requester.id, false); });
    await expect(editTicketMessage(requester, t.id, m.id, edit(), [file()], s)).rejects.toMatchObject({ status: 404 });
    await expect(listTicketMessageRevisions(requester, t.id, m.id, {})).rejects.toMatchObject({ status: 404 });
    await expect(deleteTicketMessage(requester, t.id, m.id, { expectedVersion: 1 })).rejects.toMatchObject({ status: 404 });
    const shared = await createTicketMessage(requester, t.id, body());
    s.put.mockImplementationOnce(async () => { await db.user.update({ where: { id: requester.id }, data: { authVersion: 2 } }); });
    try {
      await expect(editTicketMessage(requester, t.id, shared.id, edit(), [file()], s)).rejects.toMatchObject({ status: 401 });
      await expect(listTicketMessageRevisions(requester, t.id, shared.id, {})).rejects.toMatchObject({ status: 401 });
      await expect(deleteTicketMessage(requester, t.id, shared.id, { expectedVersion: 1 })).rejects.toMatchObject({ status: 401 });
    } finally { await db.user.update({ where: { id: requester.id }, data: { authVersion: 1 } }); }
  });

  it('follows sector transfers, accepts closed tickets and keeps inactive sectors read-only', async () => {
    const t = await ticket(), s = storage();
    const m = await createTicketMessage(member, t.id, body('Interno', 'INTERNAL'));
    const next = await db.department.create({ data: { name: 'Destino sintético' } });
    s.put.mockImplementationOnce(async () => { await operateTicket(member, t.id, 'transfer', { expectedVersion: 1, departmentId: next.id, reason: 'Transferência sintética' }); });
    await expect(editTicketMessage(member, t.id, m.id, edit(), [file()], s)).rejects.toMatchObject({ status: 404 });
    await expect(deleteTicketMessage(member, t.id, m.id, { expectedVersion: 1 })).rejects.toMatchObject({ status: 404 });
    const closed = await ticket();
    await db.ticket.update({ where: { id: closed.id }, data: { status: 'CLOSED' } });
    const shared = await createTicketMessage(requester, closed.id, body());
    await editTicketMessage(requester, closed.id, shared.id, edit());
    await db.department.update({ where: { id: sector }, data: { active: false } });
    try {
      expect((await listTicketMessages(requester, closed.id, {})).items[0]).toMatchObject({ canEdit: false, canDelete: false, canViewRevisions: true });
      expect((await listTicketMessageRevisions(requester, closed.id, shared.id, {})).total).toBe(2);
      await expect(editTicketMessage(requester, closed.id, shared.id, edit(2))).rejects.toMatchObject({ status: 403 });
      await expect(deleteTicketMessage(requester, closed.id, shared.id, { expectedVersion: 2 })).rejects.toMatchObject({ status: 403 });
    } finally { await db.department.update({ where: { id: sector }, data: { active: true } }); }
    await deleteTicketMessage(requester, closed.id, shared.id, { expectedVersion: 2 });
    expect(await db.ticket.findUniqueOrThrow({ where: { id: closed.id } })).toMatchObject({ status: 'CLOSED', version: 1 });
  });

  it('fences expired reservations and concurrent edits during upload without touching the winning publication', async () => {
    for (const action of ['expire', 'edit']) {
      const t = await ticket(), s = storage(), m = await createTicketMessage(requester, t.id, body());
      s.put.mockImplementationOnce(async () => {
        if (action === 'expire') {
          await db.ticketAttachment.updateMany({ where: { ticketId: t.id, status: 'PENDING_UPLOAD' }, data: { updatedAt: new Date(Date.now() - 31 * 60000) } });
          await cleanupAttachments(s);
        } else await editTicketMessage(requester, t.id, m.id, edit(1, 'Vencedora'));
      });
      await expect(editTicketMessage(requester, t.id, m.id, edit(), [file()], s)).rejects.toMatchObject({ status: 409 });
      expect((await listTicketMessages(requester, t.id, {})).items[0]).toMatchObject({ markdown: action === 'expire' ? 'Original' : 'Vencedora', attachments: [] });
    }
  });

  it('reserves quota against other uploads and keeps internal mutation metadata free of content and filenames', async () => {
    const t = await ticket(), s = storage();
    const m = await createTicketMessage(member, t.id, body('Segredo interno', 'INTERNAL'));
    await db.ticketAttachment.createMany({ data: Array.from({ length: 10 }, (_, i) => ({ ticketId: t.id, uploadedById: requester.id, originalName: 'quota.txt', mimeType: 'text/plain', size: 20 * 1024 * 1024 - (i === 0 ? file().bytes.length : 0), objectKey: randomUUID(), status: 'AVAILABLE' as const })) });
    s.put.mockImplementationOnce(async () => { await expect(uploadAttachments(requester, t.id, [file()], s)).rejects.toMatchObject({ status: 409 }); });
    await editTicketMessage(member, t.id, m.id, edit(1, 'Segredo corrigido'), [file('synthetic', 'secret.txt')], s);
    await deleteTicketMessage(member, t.id, m.id, { expectedVersion: 2 });
    expect((await listTicketMessages(requester, t.id, {})).total).toBe(0);
    expect((await listTicketActivities(requester, t.id, {})).total).toBe(0);
    const events = await db.outboxEvent.findMany({ where: { ticketId: t.id } });
    expect(events.map(e => e.type).sort()).toEqual(['ticket.message_created.v1', 'ticket.message_deleted.v1', 'ticket.message_edited.v1']);
    expect(JSON.stringify(events)).not.toMatch(/Segredo|secret.txt|objectKey/);
    expect(await db.ticketActivity.findMany({ where: { ticketId: t.id } })).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'ticket.message_edited', visibility: 'INTERNAL', changes: { messageId: m.id, version: 2 } }), expect.objectContaining({ action: 'ticket.message_deleted', visibility: 'INTERNAL', changes: { messageId: m.id, version: 3 } })]));
  });
});
