import { randomUUID } from 'node:crypto';
import { database } from '@cifradesk/database';
import { DomainError } from '@cifradesk/core';
import { ticketUploadInput } from '@cifradesk/contracts/tickets';
import { ticketActor, ticketWrite, type TicketActor, type TicketTx } from './tickets';
import { validateAttachment, type AttachmentFile } from './attachment-content';
import { attachmentStorage, type AttachmentStorage } from './storage';

const publicAttachment = { id: true, originalName: true, mimeType: true, size: true, status: true } as const;
async function access(tx: TicketTx, actor: TicketActor, ticketId: string, upload = false) {
  await ticketActor(tx, actor);
  const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
  const member = ticket && await tx.departmentMembership.findUnique({ where: { userId_departmentId: { userId: actor.id, departmentId: ticket.departmentId } } });
  if (!ticket || (ticket.createdById !== actor.id && !member)) throw new DomainError(404, 'Chamado não encontrado.');
  if (upload) {
    const department = await tx.department.findUnique({ where: { id: ticket.departmentId } });
    if (!department?.active) throw new DomainError(409, 'Setor desativado não recebe anexos novos.');
  }
  return ticket;
}
export async function assertAttachmentAccess(actor: TicketActor, ticketId: string) {
  await ticketWrite(tx => access(tx, actor, ticketId, true));
}
async function discard(ids: string[], storage: AttachmentStorage, release = false) {
  // Persist intent before external deletion, so a process crash remains recoverable.
  await database().ticketAttachment.updateMany({ where: { id: { in: ids }, status: { in: ['PENDING_UPLOAD', 'PENDING_DELETION', 'FAILED'] } }, data: { status: 'PENDING_DELETION' } });
  const rows = await database().ticketAttachment.findMany({ where: { id: { in: ids }, status: 'PENDING_DELETION' }, take: 100 });
  for (const row of rows) {
    try {
      await storage.remove(row.objectKey);
      // An aborted PUT can finish remotely after this first DELETE. Keep the
      // reservation until a later sweep repeats deletion after the grace period.
      if (release) await database().ticketAttachment.updateMany({ where: { id: row.id, status: 'PENDING_DELETION' }, data: { status: 'FAILED' } });
    } catch { /* Keep reserved capacity and deletion intent for the next cleanup. */ }
  }
}
export async function uploadAttachments(actor: TicketActor, ticketId: string, files: AttachmentFile[], storage: AttachmentStorage = attachmentStorage()) {
  if (files.length < 1 || files.length > 5) throw new DomainError(400, 'Envie de um a cinco arquivos.');
  const metadata = ticketUploadInput.parse({ files: files.map(validateAttachment) }).files;
  const rows = await ticketWrite(async tx => {
    await access(tx, actor, ticketId, true);
    const used = await tx.ticketAttachment.aggregate({ where: { ticketId, status: { not: 'FAILED' } }, _sum: { size: true } });
    if ((used._sum.size ?? 0) + metadata.reduce((sum, f) => sum + f.size, 0) > 200 * 1024 * 1024)
      throw new DomainError(409, 'O chamado atingiria o limite de 200 MB de anexos.');
    const reserved = [];
    for (const file of metadata) reserved.push(await tx.ticketAttachment.create({ data: {
      ...file, ticketId, uploadedById: actor.id, objectKey: `tickets/${ticketId}/${randomUUID()}`, status: 'PENDING_UPLOAD'
    } }));
    return reserved;
  });
  try {
    for (const [index, row] of rows.entries()) await storage.put(row.objectKey, files[index]!.bytes, row.mimeType);
    return await ticketWrite(async tx => {
      await access(tx, actor, ticketId, true);
      const changed = await tx.ticketAttachment.updateMany({ where: { id: { in: rows.map(r => r.id) }, status: 'PENDING_UPLOAD' }, data: { status: 'AVAILABLE' } });
      if (changed.count !== rows.length) throw new DomainError(409, 'O envio expirou. Tente novamente.');
      return tx.ticketAttachment.findMany({ where: { id: { in: rows.map(r => r.id) } }, select: publicAttachment, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 5 });
    });
  } catch {
    await discard(rows.map(r => r.id), storage);
    throw new DomainError(503, 'O chamado foi preservado, mas os anexos não foram enviados. Tente novamente.');
  }
}
export async function downloadAttachment(actor: TicketActor, ticketId: string, attachmentId: string, storage: AttachmentStorage = attachmentStorage()) {
  const read = () => ticketWrite(async tx => {
    await access(tx, actor, ticketId);
    const row = await tx.ticketAttachment.findFirst({ where: { id: attachmentId, ticketId, status: 'AVAILABLE' } });
    if (!row) throw new DomainError(404, 'Anexo não encontrado.');
    return row;
  });
  const row = await read();
  const bytes = await storage.get(row.objectKey);
  await read(); // Revocation/transfer during storage IO must not disclose content.
  return { bytes, originalName: row.originalName, mimeType: row.mimeType };
}
// Operational command only, never an unauthenticated HTTP endpoint. One bounded
// batch per invocation; retries also cover crashes between reserve/put/finalize.
export async function cleanupAttachments(storage: AttachmentStorage = attachmentStorage()) {
  const rows = await ticketWrite(async tx => {
    const expired = await tx.ticketAttachment.findMany({ where: {
      status: { in: ['PENDING_UPLOAD', 'PENDING_DELETION'] }, updatedAt: { lt: new Date(Date.now() - 30 * 60000) }
    }, select: { id: true }, orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }], take: 100 });
    await tx.ticketAttachment.updateMany({ where: { id: { in: expired.map(r => r.id) } }, data: { status: 'PENDING_DELETION' } });
    return expired;
  });
  await discard(rows.map(r => r.id), storage, true);
  return { processed: rows.length };
}
