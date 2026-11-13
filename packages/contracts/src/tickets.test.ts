import { describe, expect, it } from 'vitest';
import { createTicketInput, ticketUpdateInput, ticketListInput, ticketAttachmentInput, ticketAttachmentResponse, ticketResponse, ticketAssigneesInput, formatTicketNumber } from './tickets';

const id = 'd63c8685-b633-4864-8ca0-c2eabed98943';
const opening = { title: 'Preciso de suporte', description: 'Computador não inicia.', originDepartmentId: id, departmentId: id, requestedFor: 'SELF' };

describe('ticket contracts', () => {
  it('accepts self and another person without creating identity fields', () => {
    expect(createTicketInput.parse(opening).requestedFor).toBe('SELF');
    expect(createTicketInput.parse({ ...opening, requestedFor: 'OTHER', requesterName: ' João Sá ' })).toHaveProperty('requesterName', 'João Sá');
    expect(createTicketInput.safeParse({ ...opening, requestedFor: 'OTHER' }).success).toBe(false);
    expect(createTicketInput.safeParse({ ...opening, requesterName: 'Spoofed' }).success).toBe(false);
  });
  it.each(['createdById', 'version', 'originDepartmentName', 'priority', 'dueDate', 'status'])('rejects server-owned field %s', field => {
    expect(createTicketInput.safeParse({ ...opening, [field]: 'forged' }).success).toBe(false);
  });
  it('enforces inclusive text limits and rejects unknown fields', () => {
    for (const [field, min, max] of [['title', 5, 150], ['description', 10, 10000]] as const) {
      for (const size of [min, max]) expect(createTicketInput.safeParse({ ...opening, [field]: 'x'.repeat(size) }).success).toBe(true);
      for (const size of [min - 1, max + 1]) expect(createTicketInput.safeParse({ ...opening, [field]: 'x'.repeat(size) }).success).toBe(false);
    }
    expect(createTicketInput.safeParse({ ...opening, categoryId: id }).success).toBe(false);
  });
  it('requires the expected version and preserves date-only values', () => {
    expect(ticketUpdateInput.parse({ expectedVersion: 1, dueDate: '2028-02-29' }).dueDate).toBe('2028-02-29');
    expect(ticketUpdateInput.safeParse({ expectedVersion: 1, dueDate: '2027-02-29' }).success).toBe(false);
    expect(ticketUpdateInput.safeParse({ expectedVersion: 0, priority: 'HIGH' }).success).toBe(false);
    expect(ticketUpdateInput.safeParse({ priority: 'HIGH' }).success).toBe(false);
    expect(ticketUpdateInput.safeParse({ expectedVersion: 1 }).success).toBe(false);
    expect(ticketUpdateInput.parse({ expectedVersion: 1, dueDate: null }).dueDate).toBeNull();
  });
  it('counts Unicode characters consistently with PostgreSQL', () => {
    expect(createTicketInput.safeParse({ ...opening, title: '😀'.repeat(3) }).success).toBe(false);
    expect(createTicketInput.safeParse({ ...opening, title: '😀'.repeat(150), description: '😀'.repeat(10000) }).success).toBe(true);
    expect(createTicketInput.safeParse({ ...opening, requestedFor: 'OTHER', requesterName: '𐐀'.repeat(150) }).success).toBe(true);
  });
  it('bounds pagination without an implicit closed status', () => {
    expect(ticketListInput.parse({})).toEqual({ page: 1, pageSize: 25 });
    expect(ticketListInput.safeParse({ pageSize: 101 }).success).toBe(false);
    expect(ticketListInput.safeParse({ status: 'APPROVED' }).success).toBe(false);
    expect(ticketListInput.parse({ status: 'CLOSED' }).status).toBe('CLOSED');
  });
  it('bounds upload metadata without accepting storage keys', () => {
    const file = { originalName: 'relatorio.pdf', mimeType: 'application/pdf', size: 20 * 1024 * 1024 };
    expect(ticketAttachmentInput.safeParse(file).success).toBe(true);
    expect(ticketAttachmentInput.safeParse({ ...file, size: file.size + 1 }).success).toBe(false);
    expect(ticketAttachmentInput.safeParse({ ...file, mimeType: 'application/zip' }).success).toBe(false);
    expect(ticketAttachmentInput.safeParse({ ...file, objectKey: 'private/key' }).success).toBe(false);
  });
  it('does not expose private storage metadata in the response contract', () => {
    const person = { id: 'existing-user', name: 'Pessoa', image: null };
    const dates = { createdAt: '2026-11-13T12:00:00.000Z', updatedAt: '2026-11-13T12:00:00.000Z' };
    const response = { id, number: 123, title: opening.title, description: opening.description,
      requestedFor: 'SELF', requesterName: 'Nome histórico', createdBy: person, originDepartmentId: id,
      originDepartmentName: 'Origem histórica', department: { id, name: 'Destino' },
      status: 'OPEN', priority: 'NORMAL', dueDate: null, version: 1, assignees: [person], ...dates };
    expect(ticketResponse.safeParse(response).success).toBe(true);
    expect(ticketResponse.safeParse({ ...response, reason: 'Motivo interno' }).success).toBe(false);
    const attachment = { id, originalName: 'arquivo.pdf', mimeType: 'application/pdf', size: 100,
      status: 'AVAILABLE', uploadedBy: person, ...dates };
    expect(ticketAttachmentResponse.safeParse(attachment).success).toBe(true);
    expect(ticketAttachmentResponse.safeParse({ ...attachment, objectKey: 'private/key' }).success).toBe(false);
    expect(formatTicketNumber(123)).toBe('CH-000123');
    expect(formatTicketNumber(1000000)).toBe('CH-1000000');
    expect(() => formatTicketNumber(0)).toThrow();
  });
  it('rejects repeated assignees and accepts an empty set for later service validation', () => {
    expect(ticketAssigneesInput.safeParse({ expectedVersion: 1, userIds: ['user', 'user'] }).success).toBe(false);
    expect(ticketAssigneesInput.safeParse({ expectedVersion: 1, userIds: [] }).success).toBe(true);
  });
});
