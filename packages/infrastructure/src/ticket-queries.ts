import { database, type Prisma } from '@cifradesk/database';
import { DomainError } from '@cifradesk/core';
import { ticketActivityListResponse, ticketIdInput, ticketListScope, ticketListInput, ticketListResponse, ticketPageInput, ticketResponse } from '@cifradesk/contracts/tickets';
import { ticketActor, type TicketActor, type TicketTx } from './tickets';

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
    return ticketActivityListResponse.parse({ items: rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString() })), total, page, pageSize });
  });
}
