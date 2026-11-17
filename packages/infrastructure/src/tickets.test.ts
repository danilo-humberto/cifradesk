import { beforeEach, describe, expect, it, vi } from 'vitest';
const { tx, db } = vi.hoisted(() => {
  const tx = { $executeRaw: vi.fn(), user: { findUnique: vi.fn() }, department: { findUnique: vi.fn() },
    departmentMembership: { findUnique: vi.fn() }, ticket: { create: vi.fn() },
    ticketActivity: { create: vi.fn() }, outboxEvent: { create: vi.fn() } };
  return { tx, db: { $transaction: vi.fn(async (fn: (value: typeof tx) => unknown) => fn(tx)) } };
});
vi.mock('@cifradesk/database', () => ({ database: () => db }));
import { createTicket } from './tickets';
const origin = '00000000-0000-4000-8000-000000000001';
const destination = '00000000-0000-4000-8000-000000000002';
const input = { title: 'Preciso de ajuda', description: 'Descrição do problema', requestedFor: 'SELF', originDepartmentId: origin, departmentId: destination };
describe('ticket opening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.user.findUnique.mockResolvedValue({ id: 'actor', status: 'ACTIVE', name: 'Nome da conta', authVersion: 2 });
    tx.department.findUnique.mockResolvedValue({ id: destination, active: true });
    tx.departmentMembership.findUnique.mockResolvedValue({ department: { id: origin, name: 'Origem', active: true } });
    tx.ticket.create.mockImplementation(async ({ data }) => ({ ...data, id: 'ticket', number: 1, status: 'OPEN', priority: 'NORMAL', version: 1 }));
  });
  it('uses the authenticated actor and server snapshots, records shared history and minimal outbox', async () => {
    await createTicket({ id: 'actor', authVersion: 2 }, input);
    expect(tx.ticket.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ createdById: 'actor', requesterName: 'Nome da conta', originDepartmentName: 'Origem' }) }));
    expect(tx.ticketActivity.create).toHaveBeenCalledWith({ data: expect.objectContaining({ ticketId: 'ticket', authorId: 'actor', visibility: 'SHARED', ticketVersion: 1 }) });
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: 'ticket.created.v1', contractVersion: 1, payload: { ticketId: 'ticket', ticketVersion: 1 } }) });
  });
  it('keeps the creator separate from a freely supplied beneficiary', async () => {
    await createTicket({ id: 'actor', authVersion: 2 }, { ...input, requestedFor: 'OTHER', requesterName: 'José da Silva' });
    expect(tx.ticket.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ createdById: 'actor', requesterName: 'José da Silva' }) }));
  });
  it.each([{ createdById: 'forged' }, { priority: 'URGENT' }, { requesterName: 'forged' }, { title: 'no' }])('rejects invalid or forged body %j', async patch => {
    await expect(createTicket({ id: 'actor', authVersion: 2 }, { ...input, ...patch })).rejects.toThrow();
    expect(tx.ticket.create).not.toHaveBeenCalled();
  });
  it.each(['DISABLED', 'INVITED'])('rejects %s creators', async status => {
    tx.user.findUnique.mockResolvedValue({ status, authVersion: 2 });
    await expect(createTicket({ id: 'actor', authVersion: 2 }, input)).rejects.toMatchObject({ status: 401 });
  });
  it('rechecks session revocation inside the write transaction', async () => {
    await expect(createTicket({ id: 'actor', authVersion: 1 }, input)).rejects.toMatchObject({ status: 401 });
  });
  it('requires an active origin membership even for administrators', async () => {
    tx.departmentMembership.findUnique.mockResolvedValue(null);
    await expect(createTicket({ id: 'actor', authVersion: 2 }, input)).rejects.toMatchObject({ status: 403 });
    expect(tx.ticket.create).not.toHaveBeenCalled();
  });
  it('rejects inactive origin and destination departments', async () => {
    tx.departmentMembership.findUnique.mockResolvedValue({ department: { active: false } });
    await expect(createTicket({ id: 'actor', authVersion: 2 }, input)).rejects.toMatchObject({ status: 403 });
    tx.departmentMembership.findUnique.mockResolvedValue({ department: { active: true } });
    tx.department.findUnique.mockResolvedValue({ active: false });
    await expect(createTicket({ id: 'actor', authVersion: 2 }, input)).rejects.toMatchObject({ status: 400 });
  });
  it('permits opening for the own department without automatic assignment', async () => {
    await createTicket({ id: 'actor', authVersion: 2 }, { ...input, departmentId: origin });
    expect(tx.ticket.create.mock.calls[0]![0].data.assignees).toBeUndefined();
  });
});
