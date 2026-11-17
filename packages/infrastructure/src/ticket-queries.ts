import { database, type Prisma } from '@cifradesk/database';
import { DomainError } from '@cifradesk/core';
import { ticketActivityListResponse, ticketIdInput, ticketListScope, ticketListInput, ticketListResponse, ticketPageInput, ticketResponse } from '@cifradesk/contracts/tickets';
import { ticketActor, type TicketActor, type TicketTx } from './tickets';
import { visibleAttachments } from './ticket-attachments';

const person = { id: true, name: true, image: true } as const;
const ticketSelect = {
  id: true, number: true, title: true, description: true, requestedFor: true, requesterName: true,
  createdBy: { select: person }, originDepartmentId: true, originDepartmentName: true,
  department: { select: { id: true, name: true } }, status: true, priority: true, dueDate: true,
  version: true, assignees: { select: { user: { select: person } }, orderBy: { userId: 'asc' } },
  createdAt: true, updatedAt: true
} satisfies Prisma.TicketSelect;
type TicketRow = Prisma.TicketGetPayload<{ select: typeof ticketSelect }>;
function serializeTicket(row: TicketRow) {
  return ticketResponse.parse({ ...row, assignees: row.assignees.map(a => a.user),
    needsReassignment: ['IN_PROGRESS', 'REVIEW', 'DONE'].includes(row.status) && row.assignees.length === 0,
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
}

// One snapshot for current identity, memberships, items and counts. Queries never
// rely on memberships cached in the session. No global write lock for readers.
async function read<T>(actor: TicketActor, operation: (tx: TicketTx) => Promise<T>) {
  return database().$transaction(async tx => {
    await ticketActor(tx, actor);
    return operation(tx);
  }, { isolationLevel: 'RepeatableRead', timeout: 15000 });
}
function sectorAccess(actor: TicketActor): Prisma.TicketWhereInput {
  // An inactive department retains historical access through its memberships.
  return { department: { memberships: { some: { userId: actor.id } } } };
}
function visible(actor: TicketActor): Prisma.TicketWhereInput {
  return { OR: [{ createdById: actor.id }, sectorAccess(actor)] };
}
async function authorizedTicket(tx: TicketTx, actor: TicketActor, id: string) {
  const row = await tx.ticket.findFirst({ where: { AND: [{ id }, visible(actor)] }, select: ticketSelect });
  if (!row) throw new DomainError(404, 'Chamado não encontrado.');
  return row;
}
export async function listTickets(actor: TicketActor, scope: 'mine' | 'queue', input: unknown) {
  ticketListScope.parse(scope);
  const { page, pageSize, status, departmentId, assigneeId } = ticketListInput.parse(input);
  return read(actor, async tx => {
    const where: Prisma.TicketWhereInput = { AND: [
      scope === 'mine' ? { createdById: actor.id } : sectorAccess(actor),
      { status: status ?? { not: 'CLOSED' }, departmentId,
        ...(assigneeId ? { assignees: { some: { userId: assigneeId } } } : {}) }
    ] };
    const rows = await tx.ticket.findMany({ where, select: ticketSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize });
    const total = await tx.ticket.count({ where });
    return ticketListResponse.parse({ items: rows.map(serializeTicket), total, page, pageSize });
  });
}
export async function getTicket(actor: TicketActor, ticketId: string) {
  const id = ticketIdInput.parse(ticketId);
  return read(actor, async tx => serializeTicket(await authorizedTicket(tx, actor, id)));
}
export async function listTicketAttachments(actor: TicketActor, ticketId: string, input: unknown) {
  const id = ticketIdInput.parse(ticketId);
  const { page, pageSize } = ticketPageInput.parse(input);
  return read(actor, async tx => {
    const ticket = await authorizedTicket(tx, actor, id);
    const department = await tx.department.findUniqueOrThrow({ where: { id: ticket.department.id }, select: { active: true } });
    const where = { ticketId: id, ...visibleAttachments(actor) };
    const items = await tx.ticketAttachment.findMany({ where, select: { id: true, originalName: true, mimeType: true, size: true, status: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: pageSize, skip: (page - 1) * pageSize });
    return { items, total: await tx.ticketAttachment.count({ where }), page, pageSize, canUpload: department.active };
  });
}
export async function listTicketActivities(actor: TicketActor, ticketId: string, input: unknown) {
  const id = ticketIdInput.parse(ticketId);
  const { page, pageSize } = ticketPageInput.parse(input);
  return read(actor, async tx => {
    const ticket = await authorizedTicket(tx, actor, id);
    const member = await tx.departmentMembership.findUnique({
      where: { userId_departmentId: { userId: actor.id, departmentId: ticket.department.id } }, select: { userId: true }
    });
    const where: Prisma.TicketActivityWhereInput = { ticketId: id, ...(!member ? { visibility: 'SHARED' } : {}) };
    const rows = await tx.ticketActivity.findMany({ where, select: {
      id: true, ticketId: true, author: { select: person }, action: true, ticketVersion: true,
      changes: true, reason: true, visibility: true, createdAt: true
    }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize });
    const total = await tx.ticketActivity.count({ where });
    // Resolve only references already present in this authorized page of history.
    // Names reflect current records; the original IDs remain for auditability.
    const changes = rows.map(row => row.changes as Record<string, unknown>);
    const userIds = [...new Set(changes.flatMap(change => [change.userIds, change.previousUserIds, typeof change.removedUserId === 'string' ? [change.removedUserId] : []].flatMap(value => Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [])))];
    const departmentIds = [...new Set(changes.flatMap(change => [change.departmentId, change.previousDepartmentId].filter((id): id is string => typeof id === 'string')))];
    const people = new Map<string, string>();
    for (let offset = 0; offset < userIds.length; offset += 100) {
      for (const user of await tx.user.findMany({ where: { id: { in: userIds.slice(offset, offset + 100) } }, select: { id: true, name: true }, take: 100 })) people.set(user.id, user.name);
    }
    const departments = new Map<string, string>();
    for (let offset = 0; offset < departmentIds.length; offset += 100) {
      for (const department of await tx.department.findMany({ where: { id: { in: departmentIds.slice(offset, offset + 100) } }, select: { id: true, name: true }, take: 100 })) departments.set(department.id, department.name);
    }
    return ticketActivityListResponse.parse({ items: rows.map((row, index) => {
      const change = changes[index]!;
      const display: Record<string, unknown> = {};
      if (typeof change.removedUserId === 'string') display.removedUserName = people.get(change.removedUserId) ?? `Pessoa indisponível (${change.removedUserId})`;
      for (const key of ['userIds', 'previousUserIds']) if (Array.isArray(change[key])) display[key === 'userIds' ? 'assigneeNames' : 'previousAssigneeNames'] = (change[key] as string[]).map(id => people.get(id) ?? `Pessoa indisponível (${id})`);
      for (const key of ['departmentId', 'previousDepartmentId']) if (typeof change[key] === 'string') display[key === 'departmentId' ? 'departmentName' : 'previousDepartmentName'] = departments.get(change[key]) ?? `Setor indisponível (${change[key]})`;
      return { ...row, changes: { ...change, ...display }, createdAt: row.createdAt.toISOString() };
    }), total, page, pageSize });
  });
}
