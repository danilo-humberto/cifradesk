import { z } from 'zod';

export const ticketStatus = z.enum(['OPEN', 'PENDING', 'IN_PROGRESS', 'DONE', 'REVIEW', 'BLOCKED', 'CLOSED']);
export const ticketPriority = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
export const attachmentStatus = z.enum(['PENDING_UPLOAD', 'AVAILABLE', 'FAILED', 'PENDING_DELETION']);
export const activityVisibility = z.enum(['SHARED', 'INTERNAL']);
const uuid = z.uuid();
export const ticketIdInput = uuid;
export const ticketOperation = z.enum(['update', 'status', 'transfer', 'reopen', 'assign']);
export const ticketListScope = z.enum(['mine', 'queue']);
const userId = z.string().min(1).max(128);
const version = z.number().int().min(1).max(2147483647);
const title = z.string().trim().min(5).max(150);
const description = z.string().trim().min(10).max(10000);

// Identity, historical snapshots and defaults are supplied by the server.
const opening = { title, description, originDepartmentId: uuid, departmentId: uuid };
export const createTicketInput = z.discriminatedUnion('requestedFor', [
  z.object({ ...opening, requestedFor: z.literal('SELF') }).strict(),
  z.object({ ...opening, requestedFor: z.literal('OTHER'), requesterName: z.string().trim().min(3).max(150) }).strict()
]);

// Date-only strings are never converted to a UTC midnight. Today/future is checked
// by the service at write time using America/Sao_Paulo, not on stored records.
export const ticketUpdateInput = z.object({
  expectedVersion: version,
  title: title.optional(), description: description.optional(),
  priority: ticketPriority.optional(), dueDate: z.iso.date().nullable().optional()
}).strict().refine(value => Object.keys(value).some(key => key !== 'expectedVersion'), 'Informe uma alteração.');
export const ticketStatusInput = z.object({
  expectedVersion: version, status: ticketStatus,
  reason: z.string().trim().min(1).max(10000).optional(),
  reviewGuidance: z.string().trim().min(1).max(10000).optional(),
  solution: z.string().trim().min(1).max(10000).optional()
}).strict();
export const ticketTransferInput = z.object({ expectedVersion: version, departmentId: uuid, reason: z.string().trim().min(1).max(10000) }).strict();
export const ticketReopenInput = z.object({ expectedVersion: version, reason: z.string().trim().min(1).max(10000) }).strict();
export const ticketAssigneesInput = z.object({ expectedVersion: version, userIds: z.array(userId) }).strict()
  .refine(value => new Set(value.userIds).size === value.userIds.length, 'Responsável repetido.');
export const ticketPageInput = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
}).strict();
export const ticketListInput = ticketPageInput.extend({
  status: ticketStatus.optional(), departmentId: uuid.optional(), assigneeId: userId.optional()
}).strict();

export const ticketAttachmentInput = z.object({
  originalName: z.string().trim().min(1).max(255),
  mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg', 'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  size: z.number().int().min(1).max(20 * 1024 * 1024)
}).strict();
export const ticketUploadInput = z.object({ files: z.array(ticketAttachmentInput).min(1).max(5) }).strict();

const person = z.object({ id: userId, name: z.string(), image: z.string().nullable() }).strict();
export const ticketAttachmentResponse = z.object({
  id: uuid, originalName: z.string(), mimeType: z.string(), size: z.number().int(),
  status: attachmentStatus, uploadedBy: person, createdAt: z.iso.datetime(), updatedAt: z.iso.datetime()
}).strict();
export const ticketResponse = z.object({
  id: uuid, number: z.number().int().positive(), title: z.string(), description: z.string(),
  requestedFor: z.enum(['SELF', 'OTHER']), requesterName: z.string(), createdBy: person,
  originDepartmentId: uuid, originDepartmentName: z.string(),
  department: z.object({ id: uuid, name: z.string() }).strict(),
  status: ticketStatus, priority: ticketPriority, dueDate: z.iso.date().nullable(), version,
  assignees: z.array(person), needsReassignment: z.boolean(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime()
}).strict();
// The caller must authorize and filter visibility before pagination. No object
// key, outbox payload or internal reason is embedded in the ticket response.
export const ticketActivityResponse = z.object({
  id: uuid, ticketId: uuid, author: person, action: z.string(), ticketVersion: version,
  changes: z.record(z.string(), z.unknown()), reason: z.string().nullable(),
  visibility: activityVisibility, createdAt: z.iso.datetime()
}).strict();
const pageResponse = { page: z.number().int().positive(), pageSize: z.number().int().min(1).max(100), total: z.number().int().nonnegative() };
export const ticketListResponse = z.object({ ...pageResponse, items: z.array(ticketResponse) }).strict();
export const ticketActivityListResponse = z.object({ ...pageResponse, items: z.array(ticketActivityResponse) }).strict();
export type CreateTicketInput = z.infer<typeof createTicketInput>;
export type TicketResponse = z.infer<typeof ticketResponse>;
export type TicketStatus = z.infer<typeof ticketStatus>;
export type TicketPriority = z.infer<typeof ticketPriority>;

export function formatTicketNumber(number: number): string {
  if (!Number.isSafeInteger(number) || number < 1) throw new Error('Número de chamado inválido.');
  return `CH-${String(number).padStart(6, '0')}`;
}
