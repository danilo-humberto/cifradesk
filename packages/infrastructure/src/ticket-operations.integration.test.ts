import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { database } from '@cifradesk/database';
import { operateTicket } from './ticket-operations';
import { setMembership, updateDepartment, updateIdentity } from './identity';
import { getTicket, listTicketActivities } from './ticket-queries';

const enabled = process.env.TICKET_OPERATIONS_TEST_DATABASE === '1';
describe.skipIf(!enabled)('ticket operations PostgreSQL', () => {
  const db = enabled ? database() : undefined!;
  const creator = { id: randomUUID(), authVersion: 1 };
  const member = { id: randomUUID(), authVersion: 1 };
  const other = { id: randomUUID(), authVersion: 1 };
  const admin = { id: randomUUID(), authVersion: 1 };
  const departmentId = randomUUID(), origin = randomUUID();
  async function ticket() {
    return db.ticket.create({ data: { title: 'Teste sintético', description: 'Descrição sintética', requestedFor: 'SELF', requesterName: 'Criador', createdById: creator.id, originDepartmentId: origin, originDepartmentName: 'Origem', departmentId } });
  }
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (url.hostname !== 'postgres' || !/^\/tickets36_test_[a-f0-9]+$/.test(url.pathname)) throw new Error('Unsafe test database');
    for (const actor of [creator, member, other, admin]) await db.user.create({ data: { ...actor, name: 'Pessoa sintética', email: actor.id + '@example.test', status: 'ACTIVE', isAdmin: actor === admin } });
    await db.department.createMany({ data: [{ id: departmentId, name: 'Destino' }, { id: origin, name: 'Origem' }] });
    await db.departmentMembership.createMany({ data: [member, other].map(a => ({ userId: a.id, departmentId })).concat([{ userId: creator.id, departmentId: origin }, { userId: other.id, departmentId: origin }]) });
  });
  afterAll(async () => { await db.$disconnect(); });
  it('denies outsiders and revoked sessions without writes', async () => {
    const t = await ticket();
    for (const actor of [creator, admin]) await expect(operateTicket(actor, t.id, 'update', { expectedVersion: 1, priority: 'HIGH' })).rejects.toMatchObject({ status: 404 });
    await expect(operateTicket({ ...member, authVersion: 0 }, t.id, 'update', { expectedVersion: 1, priority: 'HIGH' })).rejects.toMatchObject({ status: 401 });
    expect(await db.ticketActivity.count({ where: { ticketId: t.id } })).toBe(0);
  });
  it('validates transitions, assignments and records shared solution with internal reasons', async () => {
    const t = await ticket();
    await expect(operateTicket(member, t.id, 'status', { expectedVersion: 1, status: 'IN_PROGRESS' })).rejects.toMatchObject({ status: 400 });
    await expect(operateTicket(member, t.id, 'assign', { expectedVersion: 1, userIds: [creator.id] })).rejects.toMatchObject({ status: 400 });
    await operateTicket(member, t.id, 'assign', { expectedVersion: 1, userIds: [member.id, other.id] });
    await operateTicket(other, t.id, 'status', { expectedVersion: 2, status: 'DONE', solution: 'Resolvido' });
    await operateTicket(member, t.id, 'status', { expectedVersion: 3, status: 'CLOSED' });
    await operateTicket(member, t.id, 'reopen', { expectedVersion: 4, reason: 'motivo privado' });
    expect((await getTicket(creator, t.id)).status).toBe('PENDING');
    const history = await listTicketActivities(creator, t.id, {});
    expect(JSON.stringify(history)).toContain('Resolvido');
    expect(JSON.stringify(history)).not.toContain('motivo privado');
    expect(await db.outboxEvent.count({ where: { ticketId: t.id } })).toBe(4);
  });
  it('permits exactly one simultaneous write with the same version', async () => {
    const t = await ticket();
    const results = await Promise.allSettled(['HIGH', 'LOW'].map(priority => operateTicket(member, t.id, 'update', { expectedVersion: 1, priority })));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(r => r.status === 'rejected')).toMatchObject({ reason: { status: 409 } });
    expect((await db.ticket.findUniqueOrThrow({ where: { id: t.id } })).version).toBe(2);
    expect(await db.ticketActivity.count({ where: { ticketId: t.id } })).toBe(1);
    expect(await db.outboxEvent.count({ where: { ticketId: t.id } })).toBe(1);
  });
  it('transfers preserving data and only compatible assignees, revoking old sector access', async () => {
    const t = await ticket();
    await operateTicket(member, t.id, 'assign', { expectedVersion: 1, userIds: [member.id, other.id] });
    await operateTicket(member, t.id, 'transfer', { expectedVersion: 2, departmentId: origin, reason: 'destino correto' });
    const result = await getTicket(creator, t.id);
    expect(result).toMatchObject({ status: 'PENDING', requesterName: t.requesterName, priority: 'NORMAL', version: 3 });
    expect(result.assignees.map(a => a.id)).toEqual([other.id]);
    await expect(getTicket(member, t.id)).rejects.toMatchObject({ status: 404 });
    await expect(operateTicket(member, t.id, 'update', { expectedVersion: 3, priority: 'HIGH' })).rejects.toMatchObject({ status: 404 });
  });
  it('rolls back the ticket and history when the outbox write fails', async () => {
    const t = await ticket();
    await db.$executeRawUnsafe(`CREATE FUNCTION fail_outbox36() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER fail_outbox36 BEFORE INSERT ON "OutboxEvent" FOR EACH ROW EXECUTE FUNCTION fail_outbox36()`);
    try {
      await expect(operateTicket(member, t.id, 'update', { expectedVersion: 1, priority: 'HIGH' })).rejects.toThrow();
      expect((await db.ticket.findUniqueOrThrow({ where: { id: t.id } })).version).toBe(1);
      expect(await db.ticketActivity.count({ where: { ticketId: t.id } })).toBe(0);
    } finally { await db.$executeRawUnsafe('DROP TRIGGER fail_outbox36 ON "OutboxEvent"'); }
  });
  it('blocks department deactivation and removes ineligible assignments with history', async () => {
    const t = await ticket();
    await operateTicket(member, t.id, 'assign', { expectedVersion: 1, userIds: [member.id, other.id] });
    await operateTicket(member, t.id, 'status', { expectedVersion: 2, status: 'IN_PROGRESS' });
    await expect(updateDepartment(admin.id, departmentId, { name: 'Destino', active: false })).rejects.toMatchObject({ status: 409 });
    await setMembership(admin.id, departmentId, other.id, false);
    expect((await getTicket(member, t.id)).assignees.map(a => a.id)).toEqual([member.id]);
    await updateIdentity(admin.id, member.id, { status: 'DISABLED' });
    const result = await getTicket(creator, t.id);
    expect(result).toMatchObject({ status: 'IN_PROGRESS', assignees: [], version: 5, needsReassignment: true });
    expect(JSON.stringify(await listTicketActivities(creator, t.id, {}))).not.toContain('desativação');
    await setMembership(admin.id, departmentId, other.id, true);
    await operateTicket(other, t.id, 'assign', { expectedVersion: 5, userIds: [other.id] });
    expect((await getTicket(creator, t.id)).needsReassignment).toBe(false);
  });
  it('serializes membership revocation against an operation in either arrival order', async () => {
    for (const revokeFirst of [true, false]) {
      await setMembership(admin.id, departmentId, other.id, true);
      const t = await ticket();
      const revoke = () => setMembership(admin.id, departmentId, other.id, false);
      const mutate = () => operateTicket(other, t.id, 'update', { expectedVersion: 1, priority: 'URGENT' });
      const results = await Promise.allSettled(revokeFirst ? [revoke(), mutate()] : [mutate(), revoke()]);
      expect(results[revokeFirst ? 0 : 1]!.status).toBe('fulfilled');
      const mutation = results[revokeFirst ? 1 : 0]!;
      if (mutation.status === 'rejected') expect(mutation.reason).toMatchObject({ status: 404 });
      const stored = await db.ticket.findUniqueOrThrow({ where: { id: t.id } });
      expect(stored.version).toBe(mutation.status === 'fulfilled' ? 2 : 1);
      expect(await db.outboxEvent.count({ where: { ticketId: t.id } })).toBe(mutation.status === 'fulfilled' ? 1 : 0);
      await expect(operateTicket(other, t.id, 'update', { expectedVersion: stored.version, priority: 'LOW' })).rejects.toMatchObject({ status: 404 });
    }
  });
  it('rejects invalid commands, inactive destinations and preserves overdue dates', async () => {
    await setMembership(admin.id, departmentId, other.id, true);
    const t = await ticket();
    for (const [operation, input] of [
      ['status', { status: 'APPROVED' }], ['status', { status: 'BLOCKED' }],
      ['status', { status: 'CLOSED' }], ['reopen', { reason: 'motivo' }],
      ['assign', { userIds: [other.id, other.id] }], ['update', { dueDate: '2000-01-01' }],
      ['transfer', { departmentId, reason: 'mesmo setor' }]
    ] as const) await expect(operateTicket(other, t.id, operation, { expectedVersion: 1, ...input })).rejects.toThrow();
    const inactive = await db.department.create({ data: { name: 'Inativo', active: false } });
    await expect(operateTicket(other, t.id, 'transfer', { expectedVersion: 1, departmentId: inactive.id, reason: 'motivo' })).rejects.toMatchObject({ status: 400 });
    await db.ticket.update({ where: { id: t.id }, data: { dueDate: new Date('2000-01-01T00:00:00Z') } });
    await operateTicket(other, t.id, 'assign', { expectedVersion: 1, userIds: [other.id] });
    await operateTicket(other, t.id, 'status', { expectedVersion: 2, status: 'DONE', solution: 'Concluído' });
    await expect(operateTicket(other, t.id, 'transfer', { expectedVersion: 3, departmentId: origin, reason: 'motivo' })).rejects.toMatchObject({ status: 400 });
    expect((await getTicket(creator, t.id)).dueDate).toBe('2000-01-01');
    await operateTicket(other, t.id, 'update', { expectedVersion: 3, dueDate: null });
    expect((await getTicket(creator, t.id)).dueDate).toBeNull();
  });
});
