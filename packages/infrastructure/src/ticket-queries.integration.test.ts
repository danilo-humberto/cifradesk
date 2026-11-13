import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { database } from '@cifradesk/database';
import { getTicket, listTickets, listTicketActivities } from './ticket-queries';

const enabled = process.env.TICKET_QUERIES_TEST_DATABASE === '1';
describe.skipIf(!enabled)('authorized ticket queries in PostgreSQL', () => {
  const db = enabled ? database() : undefined!;
  const actors = ['creator', 'member', 'outsider', 'admin'].map(name => ({ id: randomUUID(), name, authVersion: 1 }));
  const [creator, member, outsider, admin] = actors;
  const destination = randomUUID();
  const origin = randomUUID();
  const ids = Array.from({ length: 4 }, () => randomUUID()).sort();
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (url.hostname !== 'postgres' || !/^\/tickets35_test_[a-f0-9]+$/.test(url.pathname)) throw new Error('Unsafe test database');
    for (const actor of actors) await db.user.create({ data: { ...actor, email: actor.id + '@example.test', status: 'ACTIVE', isAdmin: actor === admin } });
    await db.department.createMany({ data: [{ id: origin, name: 'Origem' }, { id: destination, name: 'Destino' }] });
    await db.departmentMembership.createMany({ data: [{ userId: creator!.id, departmentId: origin }, { userId: member!.id, departmentId: destination }] });
    for (const [index, id] of ids.entries()) await db.ticket.create({ data: {
      id, title: 'Chamado sintético ' + index, description: 'Descrição sintética', requestedFor: 'OTHER',
      requesterName: outsider!.name, createdById: creator!.id, originDepartmentId: origin,
      originDepartmentName: 'Origem', departmentId: destination, status: index === 3 ? 'CLOSED' : 'OPEN',
      createdAt: new Date('2026-11-13T12:00:00Z'), dueDate: new Date('2026-11-14T00:00:00Z')
    } });
    await db.ticketAssignee.create({ data: { ticketId: ids[0]!, userId: member!.id, assignedById: member!.id } });
    for (const visibility of ['SHARED', 'INTERNAL', 'SHARED'] as const) await db.ticketActivity.create({ data: {
      ticketId: ids[0]!, authorId: member!.id, action: 'ticket.changed', ticketVersion: 1,
      visibility, reason: visibility === 'INTERNAL' ? 'segredo interno' : null, changes: {}, createdAt: new Date('2026-11-13T12:00:00Z')
    } });
  });
  afterAll(async () => { await db.$disconnect(); });
  it('separates own requests from the queue, including cross-department requests', async () => {
    expect((await listTickets(creator!, 'mine', {})).total).toBe(3);
    expect((await listTickets(creator!, 'queue', { departmentId: destination })).total).toBe(0);
    expect((await listTickets(member!, 'mine', {})).total).toBe(0);
    expect((await listTickets(member!, 'queue', {})).total).toBe(3);
    expect((await getTicket(creator!, ids[0]!)).dueDate).toBe('2026-11-14');
    expect((await getTicket(member!, ids[0]!)).assignees.map(a => a.id)).toEqual([member!.id]);
  });
  it('denies administrator, typed beneficiary and forged filters without leaking counts', async () => {
    for (const actor of [admin!, outsider!]) {
      for (const scope of ['mine', 'queue'] as const) {
        expect(await listTickets(actor, scope, { departmentId: destination, assigneeId: member!.id, page: 2 })).toMatchObject({ total: 0, items: [] });
      }
      await expect(getTicket(actor, ids[0]!)).rejects.toMatchObject({ status: 404 });
      await expect(listTicketActivities(actor, ids[0]!, {})).rejects.toMatchObject({ status: 404 });
    }
    await expect(getTicket(creator!, randomUUID())).rejects.toMatchObject({ status: 404 });
  });
  it('paginates deterministically, excludes closed by default and intersects assignee filters', async () => {
    const first = await listTickets(member!, 'queue', { pageSize: 2 });
    const second = await listTickets(member!, 'queue', { pageSize: 2, page: 2 });
    expect([...first.items, ...second.items].map(t => t.id)).toEqual(ids.slice(0, 3).reverse());
    expect(first.total).toBe(3); expect(second.total).toBe(3);
    expect((await listTickets(creator!, 'mine', { status: 'CLOSED' })).items.map(t => t.id)).toEqual([ids[3]]);
    expect((await listTickets(member!, 'queue', { assigneeId: member!.id, status: 'OPEN' })).items.map(t => t.id)).toEqual([ids[0]]);
    expect((await listTickets(member!, 'queue', { page: 100000 })).items).toEqual([]);
  });
  it('filters internal history before counting and paging, and allows members to read it', async () => {
    const first = await listTicketActivities(creator!, ids[0]!, { pageSize: 1 });
    const second = await listTicketActivities(creator!, ids[0]!, { pageSize: 1, page: 2 });
    expect(first.total).toBe(2); expect(second.total).toBe(2);
    expect(first.items[0]!.id).not.toBe(second.items[0]!.id);
    expect(JSON.stringify([first, second])).not.toContain('segredo interno');
    expect((await listTicketActivities(member!, ids[0]!, {})).total).toBe(3);
  });
  it('rechecks membership removal, transfer, account deactivation and auth version', async () => {
    await db.departmentMembership.delete({ where: { userId_departmentId: { userId: member!.id, departmentId: destination } } });
    expect((await listTickets(member!, 'queue', {})).total).toBe(0);
    await expect(getTicket(member!, ids[0]!)).rejects.toMatchObject({ status: 404 });
    await expect(listTicketActivities(member!, ids[0]!, {})).rejects.toMatchObject({ status: 404 });
    await db.departmentMembership.create({ data: { userId: member!.id, departmentId: destination } });
    await db.ticket.update({ where: { id: ids[0]! }, data: { departmentId: origin } });
    await expect(getTicket(member!, ids[0]!)).rejects.toMatchObject({ status: 404 });
    expect((await getTicket(creator!, ids[0]!)).id).toBe(ids[0]);
    await db.ticket.update({ where: { id: ids[0]! }, data: { departmentId: destination } });
    await db.user.update({ where: { id: member!.id }, data: { status: 'DISABLED' } });
    await expect(listTickets(member!, 'queue', {})).rejects.toMatchObject({ status: 401 });
    await expect(getTicket(member!, ids[0]!)).rejects.toMatchObject({ status: 401 });
    await db.user.update({ where: { id: member!.id }, data: { status: 'ACTIVE', authVersion: 2 } });
    await expect(listTicketActivities(member!, ids[0]!, {})).rejects.toMatchObject({ status: 401 });
    await db.user.update({ where: { id: member!.id }, data: { authVersion: 1 } });
  });
  it('preserves authorized historical access to inactive departments', async () => {
    await db.department.update({ where: { id: destination }, data: { active: false } });
    expect((await getTicket(member!, ids[3]!)).status).toBe('CLOSED');
    expect((await listTickets(member!, 'queue', { status: 'CLOSED' })).total).toBe(1);
    expect((await listTicketActivities(creator!, ids[0]!, {})).total).toBe(2);
  });
  it('rejects invalid pagination, unknown filters and malformed IDs', async () => {
    for (const input of [{ page: 0 }, { pageSize: 101 }, { page: 1.5 }, { status: 'APPROVED' }, { createdById: creator!.id }])
      await expect(listTickets(creator!, 'mine', input)).rejects.toThrow();
    await expect(listTicketActivities(creator!, ids[0]!, { visibility: 'INTERNAL' })).rejects.toThrow();
    await expect(getTicket(creator!, 'invalid')).rejects.toThrow();
  });
  it('executes representative query plans for creator, assignee/status and shared history', async () => {
    // Small synthetic fixture: validates SQL/index compatibility, not load capacity.
    const plans = [
      await db.$queryRaw`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT t.id FROM "Ticket" t WHERE t."createdById" = ${creator!.id} AND t.status <> 'CLOSED' ORDER BY t."createdAt" DESC, t.id DESC LIMIT 25`,
      await db.$queryRaw`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT t.id FROM "Ticket" t WHERE t.status = 'OPEN' AND EXISTS (SELECT 1 FROM "DepartmentMembership" m WHERE m."departmentId" = t."departmentId" AND m."userId" = ${member!.id}) AND EXISTS (SELECT 1 FROM "TicketAssignee" a WHERE a."ticketId" = t.id AND a."userId" = ${member!.id}) ORDER BY t."createdAt" DESC, t.id DESC LIMIT 25`,
      await db.$queryRaw`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT a.id FROM "TicketActivity" a WHERE a."ticketId" = ${ids[0]}::uuid AND a.visibility = 'SHARED' ORDER BY a."createdAt" DESC, a.id DESC LIMIT 25`
    ];
    for (const plan of plans) expect(plan).toHaveLength(1);
    console.info('Representative query plans:', JSON.stringify(plans));
  });
});
