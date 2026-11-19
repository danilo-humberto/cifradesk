import { database, type Prisma } from '@cifradesk/database';
import { DomainError } from '@cifradesk/core';
import { createTicketMessageInput, deleteTicketMessageInput, editTicketMessageInput, ticketIdInput, ticketMessagePageInput, ticketMessageResponse, ticketMessageListResponse, ticketMessageRevisionListResponse, ticketMessageRevisionSnapshot } from '@cifradesk/contracts/tickets';
import { ticketActor, ticketWrite, type TicketActor, type TicketTx } from './tickets';
import { createHash, randomUUID } from 'node:crypto';
import { validateAttachment, type AttachmentFile } from './attachment-content';
import { attachmentStorage, type AttachmentStorage } from './storage';
import { discardAttachments } from './ticket-attachments';

const messageSelect = {
  id: true, ticketId: true, author: { select: { id: true, name: true, image: true } },
  markdown: true, visibility: true, version: true, createdAt: true, updatedAt: true, deletedAt: true,
  attachments: { where: { status: 'AVAILABLE', removedAt: null }, select: { id: true, originalName: true, mimeType: true, size: true, status: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 5 }
} satisfies Prisma.TicketMessageSelect;

function serialize(row: Prisma.TicketMessageGetPayload<{ select: typeof messageSelect }>, actor: TicketActor, allowed: Awaited<ReturnType<typeof access>>) {
  const canChange = !row.deletedAt && allowed.active && row.author.id === actor.id;
  return ticketMessageResponse.parse({ ...row, markdown: row.deletedAt ? null : row.markdown, attachments: row.deletedAt ? [] : row.attachments,
    canEdit: canChange, canDelete: canChange, canViewRevisions: !row.deletedAt,
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

export async function createTicketMessage(actor: TicketActor, ticketId: string, input: unknown, files: AttachmentFile[] = [], storage?: AttachmentStorage) {
  const id = ticketIdInput.parse(ticketId);
  const data = createTicketMessageInput.parse(input);
  if (files.length > 5 || (!data.markdown.trim() && files.length === 0)) throw new DomainError(400, 'Envie texto ou até cinco arquivos.');
  const metadata = files.map(validateAttachment);
  const fingerprint = createHash('sha256').update(JSON.stringify({ markdown: data.markdown, visibility: data.visibility,
    files: metadata.map((file, index) => ({ ...file, sha256: createHash('sha256').update(files[index]!.bytes).digest('hex') })) })).digest('hex');
  const attemptId = randomUUID();
  const authorize = async (tx: TicketTx) => {
    const allowed = await access(tx, actor, id);
    if (!allowed.active) throw new DomainError(403, 'Setor desativado: conversa disponível somente para leitura.');
    if (data.visibility === 'INTERNAL' && !allowed.member) throw new DomainError(403, 'Notas internas exigem vínculo com o setor responsável.');
    return allowed;
  };
  const reserved = await ticketWrite(async tx => {
    const allowed = await authorize(tx);
    const existing = await tx.messageSubmission.findUnique({ where: { ticketId_authorId_clientId: { ticketId: id, authorId: actor.id, clientId: data.submissionId } } });
    if (existing && existing.fingerprint !== fingerprint) throw new DomainError(409, 'Identificador de envio já usado com outro conteúdo.');
    if (existing?.messageId) return { kind: 'published' as const, message: serialize(await tx.ticketMessage.findUniqueOrThrow({ where: { id: existing.messageId }, select: messageSelect }), actor, allowed) };
    if (existing?.attemptId && existing.updatedAt.getTime() > Date.now() - 30 * 60000) throw new DomainError(409, 'Envio em andamento. Aguarde antes de repetir.');
    if (existing) {
      // Fence a crashed/expired attempt before accepting another one. Its bytes
      // still consume quota until the existing cleanup confirms removal.
      await tx.ticketAttachment.updateMany({ where: { submissionId: existing.id, status: 'PENDING_UPLOAD' }, data: { status: 'PENDING_DELETION' } });
    }
    const used = await tx.ticketAttachment.aggregate({ where: { ticketId: id, status: { not: 'FAILED' } }, _sum: { size: true } });
    if ((used._sum.size ?? 0) + metadata.reduce((sum, file) => sum + file.size, 0) > 200 * 1024 * 1024) throw new DomainError(409, 'O chamado atingiria o limite de 200 MB de anexos.');
    const submission = existing
      ? await tx.messageSubmission.update({ where: { id: existing.id }, data: { attemptId } })
      : await tx.messageSubmission.create({ data: { ticketId: id, authorId: actor.id, clientId: data.submissionId, fingerprint, attemptId } });
    const rows = [];
    for (const file of metadata) rows.push(await tx.ticketAttachment.create({ data: { ...file, ticketId: id, uploadedById: actor.id,
      submissionId: submission.id, objectKey: `tickets/${id}/${randomUUID()}`, status: 'PENDING_UPLOAD' } }));
    return { kind: 'reserved' as const, submission, rows };
  });
  if (reserved.kind === 'published') return reserved.message;
  const { submission, rows } = reserved;
  let target = storage;
  try {
    if (rows.length) {
      target ??= attachmentStorage();
      // No database transaction remains open during any storage transfer.
      for (const [index, row] of rows.entries()) await target.put(row.objectKey, files[index]!.bytes, row.mimeType);
    }
    return await ticketWrite(async tx => {
      const allowed = await authorize(tx);
      const current = await tx.messageSubmission.findUniqueOrThrow({ where: { id: submission.id } });
      if (current.attemptId !== attemptId || current.messageId || current.updatedAt.getTime() <= Date.now() - 30 * 60000) throw new DomainError(409, 'O envio expirou. Tente novamente.');
      const message = await tx.ticketMessage.create({ data: { markdown: data.markdown, visibility: data.visibility, ticketId: id, authorId: actor.id } });
      const changed = await tx.ticketAttachment.updateMany({ where: { id: { in: rows.map(row => row.id) }, status: 'PENDING_UPLOAD' }, data: { messageId: message.id, status: 'AVAILABLE' } });
      if (changed.count !== rows.length) throw new DomainError(409, 'O envio expirou. Tente novamente.');
      await tx.ticketMessageRevision.create({ data: { messageId: message.id, version: 1, markdown: data.markdown, attachments: rows.map(row => ({ id: row.id, originalName: row.originalName })) } });
      await tx.ticketActivity.create({ data: { ticketId: id, authorId: actor.id, ticketVersion: allowed.ticketVersion, action: 'ticket.message_created', visibility: data.visibility, changes: { messageId: message.id } } });
      // No text, filenames or storage keys in shared event/history metadata.
      await tx.outboxEvent.create({ data: { ticketId: id, type: 'ticket.message_created.v1', contractVersion: 1, payload: { ticketId: id, messageId: message.id, visibility: data.visibility } } });
      await tx.messageSubmission.update({ where: { id: submission.id }, data: { messageId: message.id, attemptId: null } });
      return serialize(await tx.ticketMessage.findUniqueOrThrow({ where: { id: message.id }, select: messageSelect }), actor, allowed);
    });
  } catch (error) {
    // Scope cleanup to this attempt: a later retry must keep its own objects.
    // AVAILABLE rows are protected even if a commit succeeded but its reply was lost.
    await ticketWrite(async tx => {
      await tx.ticketAttachment.updateMany({ where: { id: { in: rows.map(row => row.id) }, status: 'PENDING_UPLOAD' }, data: { status: 'PENDING_DELETION' } });
      await tx.messageSubmission.updateMany({ where: { id: submission.id, attemptId, messageId: null }, data: { attemptId: null } });
    });
    if (target) await discardAttachments(rows.map(row => row.id), target);
    if (error instanceof DomainError || !rows.length) throw error;
    throw new DomainError(503, 'A mensagem não foi confirmada. Repita com o mesmo identificador de envio.');
  }
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
    return ticketMessageListResponse.parse({ items: rows.map(row => serialize(row, actor, allowed)), total, page, pageSize,
      canSend: allowed.active, canSendInternal: allowed.active && allowed.member });
  }, { isolationLevel: 'RepeatableRead', timeout: 15000 });
}

// A message identifier never grants access. In particular, an internal author
// who is still the requester must retain membership of the current sector.
async function messageAccess(tx: TicketTx, actor: TicketActor, ticketId: string, messageId: string, expectedVersion?: number) {
  const allowed = await access(tx, actor, ticketId);
  const row = await tx.ticketMessage.findFirst({ where: { id: messageId, ticketId, deletedAt: null,
    ...(!allowed.member ? { visibility: 'SHARED' } : {}) }, select: messageSelect });
  if (!row) throw new DomainError(404, 'Mensagem não encontrada.');
  if (expectedVersion !== undefined) {
    if (row.author.id !== actor.id) throw new DomainError(403, 'Somente o autor pode alterar a mensagem.');
    if (!allowed.active) throw new DomainError(403, 'Setor desativado: conversa disponível somente para leitura.');
    if (row.version !== expectedVersion || row.version === 2147483647) throw new DomainError(409, 'A mensagem foi alterada. Atualize antes de tentar novamente.');
  }
  return { row, allowed };
}

async function recordMutation(tx: TicketTx, actor: TicketActor, row: { id: string; ticketId: string; visibility: 'SHARED' | 'INTERNAL'; version: number }, ticketVersion: number, action: 'edited' | 'deleted') {
  await tx.ticketActivity.create({ data: { ticketId: row.ticketId, authorId: actor.id, ticketVersion,
    action: `ticket.message_${action}`, visibility: row.visibility, changes: { messageId: row.id, version: row.version } } });
  await tx.outboxEvent.create({ data: { ticketId: row.ticketId, type: `ticket.message_${action}.v1`, contractVersion: 1,
    payload: { ticketId: row.ticketId, messageId: row.id, version: row.version, visibility: row.visibility } } });
}

export async function editTicketMessage(actor: TicketActor, ticketId: string, messageId: string, input: unknown, files: AttachmentFile[] = [], storage?: AttachmentStorage) {
  const id = ticketIdInput.parse(ticketId), mid = ticketIdInput.parse(messageId);
  const data = editTicketMessageInput.parse(input);
  if (files.length > 5 || data.retainedAttachmentIds.length + files.length > 5 || (!data.markdown.trim() && !data.retainedAttachmentIds.length && !files.length))
    throw new DomainError(400, 'Mantenha texto ou até cinco arquivos ativos na mensagem.');
  const metadata = files.map(validateAttachment);
  const authorize = async (tx: TicketTx) => {
    const result = await messageAccess(tx, actor, id, mid, data.expectedVersion);
    if (data.retainedAttachmentIds.some(attachmentId => !result.row.attachments.some(a => a.id === attachmentId)))
      throw new DomainError(400, 'Mantenha somente anexos ativos desta mensagem.');
    return result;
  };
  const reserved = await ticketWrite(async tx => {
    const { row, allowed } = await authorize(tx);
    if (row.markdown === data.markdown && row.attachments.length === data.retainedAttachmentIds.length && !files.length)
      return { kind: 'unchanged' as const, message: serialize(row, actor, allowed) };
    const used = await tx.ticketAttachment.aggregate({ where: { ticketId: id, status: { not: 'FAILED' } }, _sum: { size: true } });
    if ((used._sum.size ?? 0) + metadata.reduce((sum, file) => sum + file.size, 0) > 200 * 1024 * 1024)
      throw new DomainError(409, 'O chamado atingiria o limite de 200 MB de anexos.');
    const rows = [];
    // Pending rows are already linked to the target message. Both conversation
    // and legacy queries hide them; cleanup can recover them without a migration.
    for (const file of metadata) rows.push(await tx.ticketAttachment.create({ data: { ...file, ticketId: id, messageId: mid,
      uploadedById: actor.id, objectKey: `tickets/${id}/${randomUUID()}`, status: 'PENDING_UPLOAD' } }));
    return { kind: 'reserved' as const, rows };
  });
  if (reserved.kind === 'unchanged') return reserved.message;
  const { rows } = reserved;
  let target = storage;
  try {
    if (rows.length) {
      target ??= attachmentStorage();
      for (const [index, row] of rows.entries()) await target.put(row.objectKey, files[index]!.bytes, row.mimeType);
    }
    return await ticketWrite(async tx => {
      const { row, allowed } = await authorize(tx);
      const published = await tx.ticketAttachment.updateMany({ where: { id: { in: rows.map(a => a.id) }, messageId: mid,
        status: 'PENDING_UPLOAD', updatedAt: { gt: new Date(Date.now() - 30 * 60000) } }, data: { status: 'AVAILABLE' } });
      if (published.count !== rows.length) throw new DomainError(409, 'O envio expirou. Tente novamente.');
      await tx.ticketAttachment.updateMany({ where: { messageId: mid, id: { in: row.attachments.filter(a => !data.retainedAttachmentIds.includes(a.id)).map(a => a.id) } }, data: { removedAt: new Date() } });
      await tx.ticketMessage.update({ where: { id: mid }, data: { markdown: data.markdown, version: { increment: 1 } } });
      const updated = await tx.ticketMessage.findUniqueOrThrow({ where: { id: mid }, select: messageSelect });
      await tx.ticketMessageRevision.create({ data: { messageId: mid, version: updated.version, markdown: updated.markdown,
        attachments: updated.attachments.map(a => ({ id: a.id, originalName: a.originalName })) } });
      await recordMutation(tx, actor, updated, allowed.ticketVersion, 'edited');
      return serialize(updated, actor, allowed);
    });
  } catch (error) {
    // Only this edit's reservations are disposable. Published and removed files
    // remain retained, even if the database committed but its reply was lost.
    await ticketWrite(async tx => {
      await tx.ticketAttachment.updateMany({ where: { id: { in: rows.map(row => row.id) }, status: 'PENDING_UPLOAD' }, data: { status: 'PENDING_DELETION' } });
    });
    if (target) await discardAttachments(rows.map(row => row.id), target);
    if (error instanceof DomainError || !rows.length) throw error;
    throw new DomainError(503, 'A edição não foi confirmada. Atualize a conversa antes de tentar novamente.');
  }
}

export async function deleteTicketMessage(actor: TicketActor, ticketId: string, messageId: string, input: unknown) {
  const id = ticketIdInput.parse(ticketId), mid = ticketIdInput.parse(messageId);
  const { expectedVersion } = deleteTicketMessageInput.parse(input);
  return ticketWrite(async tx => {
    const { allowed } = await messageAccess(tx, actor, id, mid, expectedVersion);
    const row = await tx.ticketMessage.update({ where: { id: mid }, data: { deletedAt: new Date(), version: { increment: 1 } }, select: messageSelect });
    await recordMutation(tx, actor, row, allowed.ticketVersion, 'deleted');
    return serialize(row, actor, allowed);
  });
}

export async function listTicketMessageRevisions(actor: TicketActor, ticketId: string, messageId: string, input: unknown) {
  const id = ticketIdInput.parse(ticketId), mid = ticketIdInput.parse(messageId);
  const { page, pageSize } = ticketMessagePageInput.parse(input);
  return database().$transaction(async tx => {
    const { row } = await messageAccess(tx, actor, id, mid);
    const revisions = await tx.ticketMessageRevision.findMany({ where: { messageId: mid },
      select: { id: true, messageId: true, version: true, markdown: true, attachments: true, createdAt: true },
      orderBy: { version: 'desc' }, skip: (page - 1) * pageSize, take: pageSize });
    const active = new Set(row.attachments.map(a => a.id));
    const total = await tx.ticketMessageRevision.count({ where: { messageId: mid } });
    return ticketMessageRevisionListResponse.parse({ total, page, pageSize, items: revisions.map(revision => ({ ...revision,
      createdAt: revision.createdAt.toISOString(), attachments: ticketMessageRevisionSnapshot.parse(revision.attachments).map(a => ({ ...a, available: active.has(a.id) })) })) });
  }, { isolationLevel: 'RepeatableRead', timeout: 15000 });
}
