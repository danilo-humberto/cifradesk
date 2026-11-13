import type { Prisma } from '@cifradesk/database';
import { DomainError, assertTicketDueDate, assertTicketTransition } from '@cifradesk/core';
import { ticketIdInput, ticketUpdateInput, ticketStatusInput, ticketTransferInput, ticketReopenInput, ticketAssigneesInput } from '@cifradesk/contracts/tickets';
import { ticketActor, ticketWrite, type TicketActor, type TicketTx } from './tickets';

const inputs = { update: ticketUpdateInput, status: ticketStatusInput, transfer: ticketTransferInput, reopen: ticketReopenInput, assign: ticketAssigneesInput };
export type TicketOperation = keyof typeof inputs;

async function record(tx: TicketTx, ticketId: string, authorId: string, ticketVersion: number, action: string, changes: Prisma.InputJsonObject, internal?: string, visibility: 'SHARED' | 'INTERNAL' = 'SHARED') {
  await tx.ticketActivity.create({ data: { ticketId, authorId, ticketVersion, action, changes, visibility } });
  if (internal) await tx.ticketActivity.create({ data: { ticketId, authorId, ticketVersion, action: action + '.reason', changes: {}, reason: internal, visibility: 'INTERNAL' } });
  await tx.outboxEvent.create({ data: { ticketId, type: action + '.v1', contractVersion: 1, payload: { ticketId, ticketVersion } } });
}

export async function operateTicket(actor: TicketActor, ticketId: string, operation: TicketOperation, input: unknown) {
  const id = ticketIdInput.parse(ticketId);
  if (!Object.hasOwn(inputs, operation)) throw new DomainError(400, 'Operação inválida.');
  const data = inputs[operation].parse(input);
  return ticketWrite(async tx => {
    await ticketActor(tx, actor);
    const ticket = await tx.ticket.findFirst({ where: { id, department: { active: true, memberships: { some: { userId: actor.id } } } }, include: { assignees: { include: { user: { select: { status: true, memberships: { select: { departmentId: true } } } } } } } });
    if (!ticket) throw new DomainError(404, 'Chamado não encontrado.');
    if (ticket.version !== data.expectedVersion) throw new DomainError(409, 'O chamado mudou. Recarregue antes de editar.');
    const eligible = ticket.assignees.filter(a => a.user.status === 'ACTIVE' && a.user.memberships.some(m => m.departmentId === ticket.departmentId));
    // Identity changes use the same transaction lock and maintain assignments.
    if (eligible.length !== ticket.assignees.length) throw new DomainError(409, 'Revise os responsáveis do chamado.');
    let patch: Prisma.TicketUncheckedUpdateManyInput = {};
    let changes: Prisma.InputJsonObject = {};
    let action = 'ticket.updated';
    let internal: string | undefined;
    let assigned: string[] | undefined;
    if (operation === 'update') {
      const value = ticketUpdateInput.parse(data);
      if (value.dueDate !== undefined) assertTicketDueDate(value.dueDate);
      const { expectedVersion: _version, ...fields } = value;
      void _version;
      patch = { ...fields, ...(value.dueDate !== undefined ? { dueDate: value.dueDate === null ? null : new Date(value.dueDate + 'T00:00:00Z') } : {}) };
      changes = fields;
    } else if (operation === 'status' || operation === 'reopen') {
      const value = operation === 'reopen' ? { ...ticketReopenInput.parse(data), status: 'PENDING' as const } : ticketStatusInput.parse(data);
      if (operation === 'reopen' && ticket.status !== 'CLOSED') throw new DomainError(400, 'Somente chamados fechados podem ser reabertos.');
      assertTicketTransition(ticket.status, value.status, eligible.length, value);
      patch = { status: value.status };
      changes = { from: ticket.status, status: value.status, ...('solution' in value && value.status === 'DONE' ? { solution: value.solution } : {}) };
      internal = [value.reason, 'reviewGuidance' in value ? value.reviewGuidance : undefined].filter(Boolean).join('\n') || undefined;
      action = 'ticket.status_changed';
    } else if (operation === 'assign') {
      assigned = ticketAssigneesInput.parse(data).userIds;
      const count = await tx.departmentMembership.count({ where: { departmentId: ticket.departmentId, userId: { in: assigned }, user: { status: 'ACTIVE' } } });
      if (count !== assigned.length) throw new DomainError(400, 'Selecione responsáveis ativos do setor.');
      if (!assigned.length && ['IN_PROGRESS', 'REVIEW', 'DONE'].includes(ticket.status)) throw new DomainError(400, 'Mantenha pelo menos um responsável elegível.');
      action = 'ticket.assigned';
      changes = { previousUserIds: eligible.map(a => a.userId), userIds: assigned };
    } else {
      const value = ticketTransferInput.parse(data);
      if (['DONE', 'CLOSED'].includes(ticket.status)) throw new DomainError(400, 'Revise ou reabra o chamado antes de transferir.');
      if (value.departmentId === ticket.departmentId || !await tx.department.count({ where: { id: value.departmentId, active: true } })) throw new DomainError(400, 'Escolha outro setor ativo.');
      assigned = eligible.filter(a => a.user.memberships.some(m => m.departmentId === value.departmentId)).map(a => a.userId);
      patch = { departmentId: value.departmentId, status: 'PENDING' };
      changes = { previousDepartmentId: ticket.departmentId, departmentId: value.departmentId, previousStatus: ticket.status, status: 'PENDING', previousUserIds: eligible.map(a => a.userId), userIds: assigned };
      internal = value.reason;
      action = 'ticket.transferred';
    }
    const updated = await tx.ticket.updateMany({ where: { id, version: data.expectedVersion }, data: { ...patch, version: { increment: 1 } } });
    if (updated.count !== 1) throw new DomainError(409, 'O chamado mudou. Recarregue antes de editar.');
    if (assigned) {
      await tx.ticketAssignee.deleteMany({ where: { ticketId: id, userId: { notIn: assigned } } });
      const existing = new Set(ticket.assignees.map(a => a.userId));
      await tx.ticketAssignee.createMany({ data: assigned.filter(userId => !existing.has(userId)).map(userId => ({ ticketId: id, userId, assignedById: actor.id })) });
    }
    await record(tx, id, actor.id, ticket.version + 1, action, changes, internal);
    return { id, version: ticket.version + 1 };
  });
}

// Called inside the identity transaction, after the common advisory lock.
// Bounded batches avoid loading every assignment of a user into memory.
export async function removeTicketAssignments(tx: TicketTx, authorId: string, userId: string, departmentId?: string) {
  while (true) {
    const rows = await tx.ticketAssignee.findMany({ where: { userId, ...(departmentId ? { ticket: { departmentId } } : {}) }, select: { ticketId: true }, orderBy: { ticketId: 'asc' }, take: 100 });
    if (!rows.length) return;
    for (const row of rows) {
      await tx.ticketAssignee.delete({ where: { ticketId_userId: { ticketId: row.ticketId, userId } } });
      const ticket = await tx.ticket.update({ where: { id: row.ticketId }, data: { version: { increment: 1 } }, select: { version: true } });
      const needsReassignment = await tx.ticketAssignee.count({ where: { ticketId: row.ticketId } }) === 0;
      await record(tx, row.ticketId, authorId, ticket.version, 'ticket.assignees_removed', { removedUserId: userId, needsReassignment }, 'Remoção de vínculo ou desativação.', 'INTERNAL');
    }
  }
}
