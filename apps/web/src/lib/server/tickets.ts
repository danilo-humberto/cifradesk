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
  const bytes = await boundedBytes(request, 100 * 1024 * 1024 + 64 * 1024);
  let form: FormData;
  try { form = await new Response(new Uint8Array(bytes), { headers: { 'content-type': request.headers.get('content-type') ?? '' } }).formData(); }
  catch { throw new DomainError(400, 'Envio de mensagem inválido.'); }
  if ([...form.keys()].some(key => !['markdown', 'visibility', 'submissionId', 'files'].includes(key)) ||
      ['markdown', 'visibility', 'submissionId'].some(key => form.getAll(key).length !== 1))
    throw new DomainError(400, 'Informe texto, visibilidade e identificador de envio, sem campos repetidos.');
  const data = createTicketMessageInput.parse({ markdown: form.get('markdown'), visibility: form.get('visibility'), submissionId: form.get('submissionId') });
  const files = form.getAll('files');
  if (files.length > 5 || files.some(file => typeof file === 'string' || file.size < 1 || file.size > 20 * 1024 * 1024) || (!data.markdown.trim() && !files.length))
    throw new DomainError(400, 'Envie texto ou até cinco arquivos de no máximo 20 MB cada.');
  return { data, files: await Promise.all((files as File[]).map(async file => ({ originalName: file.name, mimeType: file.type, bytes: Buffer.from(await file.arrayBuffer()) }))) };
}
