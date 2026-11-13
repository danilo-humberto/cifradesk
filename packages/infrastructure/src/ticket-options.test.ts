import { beforeEach, describe, expect, it, vi } from 'vitest';
const tx = vi.hoisted(() => ({ user: { findUnique: vi.fn() }, department: { findMany: vi.fn(), count: vi.fn() }, departmentMembership: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() } }));
vi.mock('@cifradesk/database', () => ({ database: () => ({ $transaction: (fn: (value: typeof tx) => unknown) => fn(tx) }) }));
import { listTicketOptions } from './ticket-options';
const actor = { id: 'ana', authVersion: 1 };
const departmentId = '00000000-0000-4000-8000-000000000001';
describe('opções restritas para chamados', () => {
  beforeEach(() => {
    vi.resetAllMocks(); tx.user.findUnique.mockResolvedValue({ ...actor, status: 'ACTIVE', isAdmin: true });
    tx.department.findMany.mockResolvedValue([]); tx.department.count.mockResolvedValue(0);
    tx.departmentMembership.findMany.mockResolvedValue([]); tx.departmentMembership.count.mockResolvedValue(0);
  });
  it('recusa listar integrantes sem vínculo, inclusive administrador', async () => {
    await expect(listTicketOptions(actor, { scope: 'members', departmentId })).rejects.toMatchObject({ status: 404 });
    expect(tx.departmentMembership.findMany).not.toHaveBeenCalled();
  });
  it('revalida sessão antes de consultar opções', async () => {
    tx.user.findUnique.mockResolvedValue({ ...actor, status: 'ACTIVE', authVersion: 2 });
    await expect(listTicketOptions(actor, { scope: 'destinations' })).rejects.toMatchObject({ status: 401 });
    expect(tx.department.findMany).not.toHaveBeenCalled();
  });
  it('restringe origens a vínculos próprios ativos antes de paginar', async () => {
    await listTicketOptions(actor, { scope: 'origins', page: 2 });
    expect(tx.department.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { active: true, memberships: { some: { userId: actor.id } } }, take: 20, skip: 20 }));
    expect(tx.department.count).toHaveBeenCalledWith({ where: { active: true, memberships: { some: { userId: actor.id } } } });
  });
  it('lista somente integrantes ativos e não seleciona email ou permissões', async () => {
    tx.departmentMembership.findFirst.mockResolvedValue({ userId: actor.id });
    await listTicketOptions(actor, { scope: 'members', departmentId });
    expect(tx.departmentMembership.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { departmentId, user: { status: 'ACTIVE' } }, select: { user: { select: { id: true, name: true } } }, take: 20 }));
  });
  it('rejeita escopo, paginação e parâmetros extras inválidos', async () => {
    for (const input of [{ scope: 'all' }, { scope: 'origins', page: 0 }, { scope: 'members' }, { scope: 'origins', userId: 'bia' }]) await expect(listTicketOptions(actor, input)).rejects.toThrow();
  });
});
