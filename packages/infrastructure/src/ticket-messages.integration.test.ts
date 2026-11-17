import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { database } from '@cifradesk/database';
import { createTicketMessage, listTicketMessages } from './ticket-messages';
import { listTicketActivities } from './ticket-queries';
import { operateTicket } from './ticket-operations';
import { setMembership } from './identity';

const enabled = process.env.TICKET_MESSAGES_TEST_DATABASE === '1';
describe.skipIf(!enabled)('conversation isolation PostgreSQL', () => {
  let db: ReturnType<typeof database>;
  const requester = { id: randomUUID(), authVersion: 1 };
  const member = { id: randomUUID(), authVersion: 1 };
  const outsider = { id: randomUUID(), authVersion: 1 };
  const admin = { id: randomUUID(), authVersion: 1 };
  const nextMember = { id: randomUUID(), authVersion: 1 };
  const sector = randomUUID(), nextSector = randomUUID(), origin = randomUUID();
  const input = (markdown = 'Texto sintético', visibility = 'SHARED') => ({ markdown, visibility });
  const ticket = () => db.ticket.create({ data: { title: 'Conversa sintética', description: 'Descrição sintética', requestedFor: 'SELF', requesterName: 'Solicitante', createdById: requester.id, originDepartmentId: origin, originDepartmentName: 'Origem', departmentId: sector } });
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (url.hostname !== 'postgres' || !/^\/messages42_test_[a-f0-9]+$/.test(url.pathname) || url.username !== url.pathname.slice(1)) throw new Error('Unsafe test database');
    db = database();
    const roles = await db.$queryRaw<Array<{ rolsuper: boolean; rolcreatedb: boolean; rolcreaterole: boolean }>>`SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user`;
    expect(roles).toEqual([{ rolsuper: false, rolcreatedb: false, rolcreaterole: false }]);
    for (const actor of [requester, member, outsider, admin, nextMember]) await db.user.create({ data: { ...actor, name: 'Pessoa sintética', email: actor.id + '@example.test', status: 'ACTIVE', isAdmin: actor === admin } });
    await db.department.createMany({ data: [{ id: sector, name: 'Setor' }, { id: nextSector, name: 'Novo setor' }, { id: origin, name: 'Origem' }] });
    await db.departmentMembership.createMany({ data: [{ userId: requester.id, departmentId: origin }, { userId: member.id, departmentId: sector }, { userId: nextMember.id, departmentId: nextSector }] });
  });
  afterAll(async () => { await db?.$disconnect(); });

  it('publishes shared text with session author, first revision, history and minimal event', async () => {
    const t = await ticket();
    const message = await createTicketMessage(requester, t.id, input('  **Markdown**  '));
    expect(message).toMatchObject({ ticketId: t.id, markdown: '  **Markdown**  ', author: { id: requester.id }, visibility: 'SHARED', version: 1 });
    const result = await listTicketMessages(member, t.id, {});
    expect(result).toMatchObject({ total: 1, page: 1, pageSize: 20, canSend: true, canSendInternal: true });
    expect(result.items[0]).toMatchObject({ id: message.id, markdown: message.markdown });
    expect(await db.ticketMessageRevision.findMany({ where: { messageId: message.id } })).toEqual([expect.objectContaining({ version: 1, markdown: message.markdown, attachments: [] })]);
    expect(await db.ticketActivity.findMany({ where: { ticketId: t.id } })).toEqual([expect.objectContaining({ visibility: 'SHARED', changes: { messageId: message.id }, reason: null })]);
    expect(await db.outboxEvent.findMany({ where: { ticketId: t.id } })).toEqual([expect.objectContaining({ type: 'ticket.message_created.v1', payload: { ticketId: t.id, messageId: message.id, visibility: 'SHARED' } })]);
  });

  it('filters internal text, identifiers, totals and history before pagination', async () => {
    const t = await ticket();
    const secret = await createTicketMessage(member, t.id, input('Segredo interno', 'INTERNAL'));
    const shared = await createTicketMessage(requester, t.id, input('Resposta pública'));
    const result = await listTicketMessages(requester, t.id, { pageSize: 1 });
    expect(result).toMatchObject({ total: 1, canSendInternal: false, items: [{ id: shared.id }] });
    expect((await listTicketMessages(requester, t.id, { page: 2, pageSize: 1 })).items).toEqual([]);
    const publicData = JSON.stringify([result, await listTicketActivities(requester, t.id, {})]);
    expect(publicData).not.toContain(secret.id);
    expect(publicData).not.toContain('Segredo interno');
    expect((await listTicketMessages(member, t.id, {})).total).toBe(2);
    const event = await db.outboxEvent.findFirstOrThrow({ where: { ticketId: t.id, payload: { path: ['messageId'], equals: secret.id } } });
    expect(event.payload).toEqual({ ticketId: t.id, messageId: secret.id, visibility: 'INTERNAL' });
    await expect(createTicketMessage(requester, t.id, input('Tentativa', 'INTERNAL'))).rejects.toMatchObject({ status: 403 });
  });

  it('denies outsiders, unrelated admins and manipulated identifiers without writes', async () => {
    const t = await ticket();
    for (const actor of [outsider, admin]) {
      await expect(listTicketMessages(actor, t.id, {})).rejects.toMatchObject({ status: 404 });
      await expect(createTicketMessage(actor, t.id, input())).rejects.toMatchObject({ status: 404 });
    }
    for (const id of [randomUUID(), nextSector]) await expect(listTicketMessages(member, id, {})).rejects.toMatchObject({ status: 404 });
    await expect(createTicketMessage(member, randomUUID(), input())).rejects.toMatchObject({ status: 404 });
    for (const patch of [{ authorId: member.id }, { ticketId: randomUUID() }, { attachments: [] }, { markdown: '' }, { markdown: ' \n ' }, { markdown: 'a'.repeat(10001) }, { visibility: 'PUBLIC' }]) {
      await expect(createTicketMessage(requester, t.id, { ...input(), ...patch })).rejects.toThrow();
    }
    expect(await db.ticketMessage.count({ where: { ticketId: t.id } })).toBe(0);
    expect(await db.ticketActivity.count({ where: { ticketId: t.id } })).toBe(0);
    expect(await db.outboxEvent.count({ where: { ticketId: t.id } })).toBe(0);
  });

  it('accepts closed tickets without reopening and keeps inactive sectors read-only', async () => {
    const t = await ticket();
    await db.ticket.update({ where: { id: t.id }, data: { status: 'CLOSED' } });
    await createTicketMessage(requester, t.id, input());
    expect(await db.ticket.findUniqueOrThrow({ where: { id: t.id } })).toMatchObject({ status: 'CLOSED', version: 1 });
    await db.department.update({ where: { id: sector }, data: { active: false } });
    try {
      for (const actor of [requester, member]) {
        expect(await listTicketMessages(actor, t.id, {})).toMatchObject({ total: 1, canSend: false, canSendInternal: false });
        await expect(createTicketMessage(actor, t.id, input())).rejects.toMatchObject({ status: 403 });
      }
    } finally { await db.department.update({ where: { id: sector }, data: { active: true } }); }
  });

  it('rejects inactive users and stale sessions on reads and writes', async () => {
    const t = await ticket();
    for (const actor of [{ ...requester, authVersion: 0 }, outsider]) {
      if (actor.id === outsider.id) await db.user.update({ where: { id: outsider.id }, data: { status: 'DISABLED' } });
      try {
        await expect(listTicketMessages(actor, t.id, {})).rejects.toMatchObject({ status: 401 });
        await expect(createTicketMessage(actor, t.id, input())).rejects.toMatchObject({ status: 401 });
      } finally { await db.user.update({ where: { id: outsider.id }, data: { status: 'ACTIVE' } }); }
    }
  });

  it('uses the current sector after transfer and grants no special access to the author', async () => {
    const t = await ticket();
    const message = await createTicketMessage(member, t.id, input('Nota do setor', 'INTERNAL'));
    await operateTicket(member, t.id, 'transfer', { expectedVersion: 1, departmentId: nextSector, reason: 'Transferência sintética' });
    await expect(listTicketMessages(member, t.id, {})).rejects.toMatchObject({ status: 404 });
    await expect(createTicketMessage(member, t.id, input())).rejects.toMatchObject({ status: 404 });
    expect((await listTicketMessages(nextMember, t.id, {})).items[0]!.id).toBe(message.id);
    expect((await listTicketMessages(requester, t.id, {})).total).toBe(0);
    await setMembership(admin.id, nextSector, requester.id, true);
    await createTicketMessage(requester, t.id, input('Nota do solicitante vinculado', 'INTERNAL'));
    await setMembership(admin.id, nextSector, requester.id, false);
    expect((await listTicketMessages(requester, t.id, {})).total).toBe(0);
    await expect(createTicketMessage(requester, t.id, input('Tentativa', 'INTERNAL'))).rejects.toMatchObject({ status: 403 });
  });

  it('paginates with a stable identifier tie-break and enforces the maximum', async () => {
    const t = await ticket();
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const ids = Array.from({ length: 105 }, () => randomUUID()).sort().reverse();
    await db.ticketMessage.createMany({ data: ids.map(id => ({ id, ticketId: t.id, authorId: member.id, visibility: 'SHARED', markdown: id, createdAt })) });
    expect((await listTicketMessages(requester, t.id, {})).items.map(m => m.id)).toEqual(ids.slice(0, 20));
    expect((await listTicketMessages(requester, t.id, { pageSize: 100 })).items.map(m => m.id)).toEqual(ids.slice(0, 100));
    expect((await listTicketMessages(requester, t.id, { pageSize: 100, page: 2 })).items.map(m => m.id)).toEqual(ids.slice(100));
    for (const query of [{ pageSize: 101 }, { page: 0 }, { visibility: 'INTERNAL' }, { authorId: member.id }]) await expect(listTicketMessages(requester, t.id, query)).rejects.toThrow();
  });

  it('returns only a tombstone for removed messages, never retained text or revisions', async () => {
    const t = await ticket();
    const message = await createTicketMessage(requester, t.id, input('Conteúdo retido'));
    await db.ticketMessage.update({ where: { id: message.id }, data: { deletedAt: new Date() } });
    const result = await listTicketMessages(requester, t.id, {});
    expect(result.items[0]).toMatchObject({ id: message.id, markdown: null });
    expect(JSON.stringify(result)).not.toContain('Conteúdo retido');
    expect(JSON.stringify(result)).not.toContain('revisions');
  });

  it('rolls back message, revision and history if recording the event fails', async () => {
    const t = await ticket();
    await db.$executeRawUnsafe(`CREATE FUNCTION fail_outbox42() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER fail_outbox42 BEFORE INSERT ON "OutboxEvent" FOR EACH ROW EXECUTE FUNCTION fail_outbox42()`);
    try {
      await expect(createTicketMessage(requester, t.id, input())).rejects.toThrow('synthetic failure');
      expect(await db.ticketMessage.count({ where: { ticketId: t.id } })).toBe(0);
      expect(await db.ticketMessageRevision.count({ where: { message: { ticketId: t.id } } })).toBe(0);
      expect(await db.ticketActivity.count({ where: { ticketId: t.id } })).toBe(0);
      expect(await db.outboxEvent.count({ where: { ticketId: t.id } })).toBe(0);
    } finally { await db.$executeRawUnsafe('DROP TRIGGER fail_outbox42 ON "OutboxEvent"'); }
  });
});
