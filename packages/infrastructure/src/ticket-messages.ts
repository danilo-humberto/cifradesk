import { database, type Prisma } from '@cifradesk/database';
import { DomainError } from '@cifradesk/core';
import { createTicketMessageInput, ticketIdInput, ticketMessagePageInput, ticketMessageResponse, ticketMessageListResponse } from '@cifradesk/contracts/tickets';
import { ticketActor, ticketWrite, type TicketActor, type TicketTx } from './tickets';

const messageSelect = {
  id: true, ticketId: true, author: { select: { id: true, name: true, image: true } },
  markdown: true, visibility: true, version: true, createdAt: true, updatedAt: true, deletedAt: true
} satisfies Prisma.TicketMessageSelect;

function serialize(row: Prisma.TicketMessageGetPayload<{ select: typeof messageSelect }>) {
  return ticketMessageResponse.parse({ ...row, markdown: row.deletedAt ? null : row.markdown,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), deletedAt: row.deletedAt?.toISOString() ?? null });
}

async function access(tx: TicketTx, actor: TicketActor, id: string) {
  await ticketActor(tx, actor);
  const ticket = await tx.ticket.findFirst({
    where: { id, OR: [{ createdById: actor.id }, { department: { memberships: { some: { userId: actor.id } } } }] },
    select: { version: true, department: { select: { active: true, memberships: { where: { userId: actor.id }, select: { userId: true }, take: 1 } } } }
  });
  if (!ticket) throw new DomainError(404, 'Chamado não encontrado.');
  return { ticketVersion: ticket.version, active: ticket.department.active, member: ticket.department.memberships.length > 0 };
}

export async function createTicketMessage(actor: TicketActor, ticketId: string, input: unknown) {
  const id = ticketIdInput.parse(ticketId);
  const data = createTicketMessageInput.parse(input);
  // Serializes with transfers, membership revocation and identity changes.
  return ticketWrite(async tx => {
    const allowed = await access(tx, actor, id);
    if (!allowed.active) throw new DomainError(403, 'Setor desativado: conversa disponível somente para leitura.');
    if (data.visibility === 'INTERNAL' && !allowed.member) throw new DomainError(403, 'Notas internas exigem vínculo com o setor responsável.');
    const message = await tx.ticketMessage.create({ data: { ...data, ticketId: id, authorId: actor.id }, select: messageSelect });
    await tx.ticketMessageRevision.create({ data: { messageId: message.id, version: 1, markdown: data.markdown, attachments: [] } });
    await tx.ticketActivity.create({ data: {
      ticketId: id, authorId: actor.id, ticketVersion: allowed.ticketVersion, action: 'ticket.message_created',
      visibility: data.visibility, changes: { messageId: message.id }
    } });
    // Consumers must resolve current recipients/permissions; never broadcast by ticket alone.
    await tx.outboxEvent.create({ data: {
      ticketId: id, type: 'ticket.message_created.v1', contractVersion: 1,
      payload: { ticketId: id, messageId: message.id, visibility: data.visibility }
    } });
    return serialize(message);
  });
}

export async function listTicketMessages(actor: TicketActor, ticketId: string, input: unknown) {
  const id = ticketIdInput.parse(ticketId);
  const { page, pageSize } = ticketMessagePageInput.parse(input);
  // Identity, current membership, count and page belong to a single snapshot.
  return database().$transaction(async tx => {
    const allowed = await access(tx, actor, id);
    const where: Prisma.TicketMessageWhereInput = { ticketId: id, ...(!allowed.member ? { visibility: 'SHARED' } : {}) };
    const rows = await tx.ticketMessage.findMany({ where, select: messageSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize });
    const total = await tx.ticketMessage.count({ where });
    return ticketMessageListResponse.parse({ items: rows.map(serialize), total, page, pageSize,
      canSend: allowed.active, canSendInternal: allowed.active && allowed.member });
  }, { isolationLevel: 'RepeatableRead', timeout: 15000 });
}
