import 'server-only';
import { DomainError } from '@cifradesk/core';
import { createTicketMessageInput, editTicketMessageInput } from '@cifradesk/contracts/tickets';
import { boundedBytes } from './http';
export { createTicket, uploadAttachments, downloadAttachment, assertAttachmentAccess } from '@cifradesk/infrastructure';
export { getTicket, listTickets, listTicketActivities, listTicketAttachments } from '@cifradesk/infrastructure';
export { operateTicket } from '@cifradesk/infrastructure';
export { createTicketMessage, listTicketMessages, editTicketMessage, deleteTicketMessage, listTicketMessageRevisions } from '@cifradesk/infrastructure';

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

async function messageForm(request: Request) {
  const bytes = await boundedBytes(request, 100 * 1024 * 1024 + 64 * 1024);
  let form: FormData;
  try { form = await new Response(new Uint8Array(bytes), { headers: { 'content-type': request.headers.get('content-type') ?? '' } }).formData(); }
  catch { throw new DomainError(400, 'Envio de mensagem inválido.'); }
  return form;
}

function messageFiles(form: FormData) {
  const files = form.getAll('files');
  if (files.length > 5 || files.some(file => typeof file === 'string' || file.size < 1 || file.size > 20 * 1024 * 1024))
    throw new DomainError(400, 'Envie até cinco arquivos de no máximo 20 MB cada.');
  return files as File[];
}

async function fileBytes(files: File[]) {
  return Promise.all(files.map(async file => ({ originalName: file.name, mimeType: file.type, bytes: Buffer.from(await file.arrayBuffer()) })));
}

export async function messageBody(request: Request) {
  const form = await messageForm(request);
  if ([...form.keys()].some(key => !['markdown', 'visibility', 'submissionId', 'files'].includes(key)) ||
      ['markdown', 'visibility', 'submissionId'].some(key => form.getAll(key).length !== 1))
    throw new DomainError(400, 'Informe texto, visibilidade e identificador de envio, sem campos repetidos.');
  const data = createTicketMessageInput.parse({ markdown: form.get('markdown'), visibility: form.get('visibility'), submissionId: form.get('submissionId') });
  const files = messageFiles(form);
  if (!data.markdown.trim() && !files.length) throw new DomainError(400, 'Envie texto ou arquivos.');
  return { data, files: await fileBytes(files) };
}

export async function messageEditBody(request: Request) {
  const form = await messageForm(request);
  const fields = ['expectedVersion', 'markdown', 'retainedAttachmentIds'];
  if ([...form.keys()].some(key => ![...fields, 'files'].includes(key)) || fields.some(key => form.getAll(key).length !== 1))
    throw new DomainError(400, 'Informe versão, texto e anexos mantidos, sem campos repetidos.');
  const expectedVersion = form.get('expectedVersion'), retained = form.get('retainedAttachmentIds');
  if (typeof expectedVersion !== 'string' || !/^[1-9]\d*$/.test(expectedVersion) || typeof retained !== 'string')
    throw new DomainError(400, 'Versão ou anexos inválidos.');
  const data = editTicketMessageInput.parse({ expectedVersion: Number(expectedVersion), markdown: form.get('markdown'), retainedAttachmentIds: JSON.parse(retained) });
  const files = messageFiles(form), count = data.retainedAttachmentIds.length + files.length;
  if (count > 5 || (!data.markdown.trim() && !count)) throw new DomainError(400, 'Mantenha texto ou até cinco arquivos ativos.');
  return { data, files: await fileBytes(files) };
}
