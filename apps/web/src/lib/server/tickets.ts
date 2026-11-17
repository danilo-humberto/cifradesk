import 'server-only';
import { DomainError } from '@cifradesk/core';
import { createTicketMessageInput } from '@cifradesk/contracts/tickets';
import { boundedBytes } from './http';
export { createTicket, uploadAttachments, downloadAttachment, assertAttachmentAccess } from '@cifradesk/infrastructure';
export { getTicket, listTickets, listTicketActivities, listTicketAttachments } from '@cifradesk/infrastructure';
export { operateTicket } from '@cifradesk/infrastructure';
export { createTicketMessage, listTicketMessages } from '@cifradesk/infrastructure';

export function ticketQuery(request: Request) {
  const query: Record<string, string> = {};
  for (const [key, value] of new URL(request.url).searchParams) {
    if (Object.hasOwn(query, key)) throw new DomainError(400, 'Parâmetro repetido.');
    Object.defineProperty(query, key, { value, enumerable: true, configurable: true });
  }
  return query;
}

export async function attachmentFiles(request: Request) {
  // Bound the actual body before the multipart parser buffers it, including chunked uploads.
  const bytes = await boundedBytes(request, 100 * 1024 * 1024 + 64 * 1024);
  let form: FormData;
  try { form = await new Response(new Uint8Array(bytes), { headers: { 'content-type': request.headers.get('content-type') ?? '' } }).formData(); }
  catch { throw new DomainError(400, 'Envio de arquivos inválido.'); }
  const files = form.getAll('files');
  if ([...form.keys()].some(key => key !== 'files') || files.length < 1 || files.length > 5 || files.some(file => typeof file === 'string'))
    throw new DomainError(400, 'Envie de um a cinco arquivos no campo files.');
  return Promise.all((files as File[]).map(async file => ({ originalName: file.name, mimeType: file.type, bytes: Buffer.from(await file.arrayBuffer()) })));
}

export async function messageBody(request: Request) {
  const bytes = await boundedBytes(request, 64 * 1024);
  let form: FormData;
  try { form = await new Response(new Uint8Array(bytes), { headers: { 'content-type': request.headers.get('content-type') ?? '' } }).formData(); }
  catch { throw new DomainError(400, 'Envio de mensagem inválido.'); }
  if ([...form.keys()].some(key => key !== 'markdown' && key !== 'visibility') ||
      form.getAll('markdown').length !== 1 || form.getAll('visibility').length !== 1)
    throw new DomainError(400, 'Informe somente texto e visibilidade, sem campos repetidos.');
  return createTicketMessageInput.parse({ markdown: form.get('markdown'), visibility: form.get('visibility') });
}
