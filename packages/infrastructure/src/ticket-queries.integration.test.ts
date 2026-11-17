import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { database } from '@cifradesk/database';
import { getTicket, listTickets, listTicketActivities, listTicketAttachments } from './ticket-queries';
import { listTicketOptions } from './ticket-options';
import { setMembership } from './identity';

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
  it('oferece opções restritas com paginação real e sem dados de conta', async () => {
    expect((await listTicketOptions(creator!, { scope: 'origins' })).items.map(row => row.id)).toEqual([origin]);
    expect((await listTicketOptions(outsider!, { scope: 'origins' })).total).toBe(0);
    await expect(listTicketOptions(admin!, { scope: 'members', departmentId: destination })).rejects.toMatchObject({ status: 404 });
    expect((await listTicketOptions(member!, { scope: 'members', departmentId: destination })).items).toEqual([{ id: member!.id, name: member!.name }]);
    const extra = Array.from({ length: 21 }, (_, i) => ({ id: randomUUID(), name: 'Extra ' + String(i).padStart(2, '0') }));
    await db.department.createMany({ data: extra });
    const first = await listTicketOptions(creator!, { scope: 'destinations' });
    const second = await listTicketOptions(creator!, { scope: 'destinations', page: 2 });
    expect(first.items).toHaveLength(20); expect(second.items).toHaveLength(3);
    expect(new Set([...first.items, ...second.items].map(row => row.id)).size).toBe(23);
  });
  it('resolve nomes das referências autorizadas no histórico sem perder IDs', async () => {
    const activity = await db.ticketActivity.create({ data: { ticketId: ids[1]!, authorId: member!.id, ticketVersion: 1, action: 'ticket.transferred', visibility: 'SHARED', changes: { userIds: [member!.id], previousUserIds: [], departmentId: destination, previousDepartmentId: origin } } });
    const result = await listTicketActivities(creator!, ids[1]!, {});
    expect(result.items.find(row => row.id === activity.id)?.changes).toMatchObject({ userIds: [member!.id], assigneeNames: [member!.name], previousAssigneeNames: [], departmentName: 'Destino', previousDepartmentName: 'Origem' });
    await db.ticketActivity.create({ data: { ticketId: ids[1]!, authorId: member!.id, ticketVersion: 1, action: 'ticket.assignees_removed', visibility: 'INTERNAL', changes: { removedUserId: member!.id } } });
    expect((await listTicketActivities(member!, ids[1]!, {})).items[0]?.changes).toMatchObject({ removedUserId: member!.id, removedUserName: member!.name });
    expect((await listTicketActivities(creator!, ids[1]!, {})).items.some(row => row.changes.removedUserName)).toBe(false);
  });
  it('separates own requests from the queue, including cross-department requests', async () => {
    expect((await listTickets(creator!, 'mine', {})).total).toBe(3);
    expect((await listTickets(creator!, 'queue', { departmentId: destination })).total).toBe(0);
    expect((await listTickets(member!, 'mine', {})).total).toBe(0);
    expect((await listTickets(member!, 'queue', {})).total).toBe(3);
    expect((await getTicket(creator!, ids[0]!)).dueDate).toBe('2026-11-14');
    expect((await getTicket(member!, ids[0]!)).assignees.map(a => a.id)).toEqual([member!.id]);
  });
  it('lista anexos paginados sem chave privada e aplica o acesso do detalhe', async () => {
    await db.ticketAttachment.create({ data: { ticketId: ids[0]!, uploadedById: creator!.id, originalName: 'teste.txt', mimeType: 'text/plain', size: 10, objectKey: 'private/teste', status: 'AVAILABLE' } });
    const result = await listTicketAttachments(creator!, ids[0]!, { pageSize: 1 });
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ originalName: 'teste.txt', status: 'AVAILABLE' });
    expect(result.items[0]).not.toHaveProperty('objectKey');
    await expect(listTicketAttachments(outsider!, ids[0]!, {})).rejects.toMatchObject({ status: 404 });
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
  it('pagina volume sintético e remove atribuições em mais de dois lotes', async () => {
    // A bounded local measurement, not a production capacity or latency SLA.
    const owner = await db.user.create({ data: { id: randomUUID(), name: 'Volume owner', email: randomUUID() + '@example.test', status: 'ACTIVE', isAdmin: true } });
    const assignee = await db.user.create({ data: { id: randomUUID(), name: 'Volume member', email: randomUUID() + '@example.test', status: 'ACTIVE' } });
    const sector = await db.department.create({ data: { name: 'Volume ' + randomUUID(), memberships: { create: [{ userId: owner.id }, { userId: assignee.id }] } } });
    const ticketIds = Array.from({ length: 2000 }, () => randomUUID());
    for (let offset = 0; offset < ticketIds.length; offset += 250) {
      await db.ticket.createMany({ data: ticketIds.slice(offset, offset + 250).map(id => ({ id, title: 'Volume sintético', description: 'Medição local com dados sintéticos', createdById: owner.id, requestedFor: 'SELF' as const, requesterName: owner.name, originDepartmentId: sector.id, originDepartmentName: sector.name, departmentId: sector.id, status: 'IN_PROGRESS' as const })) });
    }
    const assignedIds = ticketIds.slice(0, 250);
    await db.ticketAssignee.createMany({ data: assignedIds.map(ticketId => ({ ticketId, userId: assignee.id, assignedById: owner.id })) });
    const started = performance.now();
    const first = await listTickets(owner, 'queue', { departmentId: sector.id, page: 1, pageSize: 20 });
    const last = await listTickets(owner, 'queue', { departmentId: sector.id, page: 100, pageSize: 20 });
    const filtered = await listTickets(owner, 'queue', { departmentId: sector.id, assigneeId: assignee.id, status: 'IN_PROGRESS', pageSize: 20 });
    expect(first.total).toBe(2000); expect(last.total).toBe(2000);
    expect(first.items).toHaveLength(20); expect(last.items).toHaveLength(20);
    expect(new Set([...first.items, ...last.items].map(row => row.id)).size).toBe(40);
    expect(filtered.total).toBe(250); expect(filtered.items).toHaveLength(20);
    const queriesMs = performance.now() - started;
    expect((await listTickets(outsider!, 'queue', { departmentId: sector.id })).total).toBe(0);
    const removalStarted = performance.now();
    await setMembership(owner.id, sector.id, assignee.id, false);
    const removalMs = performance.now() - removalStarted;
    expect(await db.ticketAssignee.count({ where: { userId: assignee.id } })).toBe(0);
    expect(await db.ticket.count({ where: { id: { in: assignedIds }, version: 2, status: 'IN_PROGRESS' } })).toBe(250);
    expect(await db.ticketActivity.count({ where: { ticketId: { in: assignedIds }, action: 'ticket.assignees_removed', visibility: 'INTERNAL' } })).toBe(250);
    expect(await db.outboxEvent.count({ where: { ticketId: { in: assignedIds }, type: 'ticket.assignees_removed.v1' } })).toBe(250);
    expect((await listTickets(assignee, 'queue', { departmentId: sector.id })).total).toBe(0);
    expect((await getTicket(owner, assignedIds[0]!)).needsReassignment).toBe(true);
    console.info('Bounded synthetic volume:', JSON.stringify({ tickets: 2000, assignmentsRemoved: 250, threeQueriesMs: Math.round(queriesMs), removalMs: Math.round(removalMs) }));
  }, 60000);
});
