import { database, type Prisma } from '@cifradesk/database';
import { assertActive, DomainError } from '@cifradesk/core';
import { createTicketInput } from '@cifradesk/contracts/tickets';

export type TicketActor = { id: string; authVersion: number };
export type TicketTx = Prisma.TransactionClient;

// Same lock as identity changes: the user, memberships and departments cannot
// be revoked between validation and commit. Never hold this lock during S3 IO.
export async function ticketWrite<T>(operation: (tx: TicketTx) => Promise<T>) {
  return database().$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(724013)`;
    return operation(tx);
  }, { timeout: 15000 });
}
export async function ticketActor(tx: TicketTx, actor: TicketActor) {
  const user = await tx.user.findUnique({ where: { id: actor.id } });
  assertActive(user);
  if (!user || user.authVersion !== actor.authVersion) throw new DomainError(401, 'Sessão encerrada. Entre novamente.');
  return user;
}
export async function createTicket(actor: TicketActor, input: unknown) {
  const data = createTicketInput.parse(input);
  return ticketWrite(async tx => {
    const user = await ticketActor(tx, actor);
    const membership = await tx.departmentMembership.findUnique({
      where: { userId_departmentId: { userId: user.id, departmentId: data.originDepartmentId } },
      include: { department: true }
    });
    if (!membership?.department.active) throw new DomainError(403, 'Escolha um departamento ativo ao qual você pertence. Sem vínculo, procure o administrador.');
    const destination = await tx.department.findUnique({ where: { id: data.departmentId } });
    if (!destination?.active) throw new DomainError(400, 'Selecione um setor de atendimento ativo.');
    const ticket = await tx.ticket.create({ data: {
      ...data, createdById: user.id,
      requesterName: data.requestedFor === 'SELF' ? user.name : data.requesterName,
      originDepartmentName: membership.department.name
    }, select: { id: true, number: true, status: true, priority: true, version: true, createdAt: true } });
    await tx.ticketActivity.create({ data: {
      ticketId: ticket.id, authorId: user.id, action: 'ticket.created', ticketVersion: 1,
      changes: { status: 'OPEN', departmentId: data.departmentId }, visibility: 'SHARED'
    } });
    await tx.outboxEvent.create({ data: {
      ticketId: ticket.id, type: 'ticket.created.v1', contractVersion: 1,
      payload: { ticketId: ticket.id, ticketVersion: 1 }
    } });
    return ticket;
  });
}
