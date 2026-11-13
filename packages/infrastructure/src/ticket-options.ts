import { ticketOptionsInput } from '@cifradesk/contracts/tickets';
import { database, type Prisma } from '@cifradesk/database';
import { DomainError } from '@cifradesk/core';
import { ticketActor, type TicketActor } from './tickets';

export async function listTicketOptions(actor: TicketActor, input: unknown) {
  const data = ticketOptionsInput.parse(input);
  return database().$transaction(async tx => {
    await ticketActor(tx, actor);
    const paging = { take: 20, skip: (data.page - 1) * 20 };
    if (data.scope === 'members') {
      const membership = await tx.departmentMembership.findFirst({ where: { userId: actor.id, departmentId: data.departmentId, department: { active: true } }, select: { userId: true } });
      if (!membership) throw new DomainError(404, 'Setor não encontrado.');
      const where = { departmentId: data.departmentId, user: { status: 'ACTIVE' as const } };
      const rows = await tx.departmentMembership.findMany({ where, ...paging, orderBy: [{ user: { name: 'asc' } }, { userId: 'asc' }], select: { user: { select: { id: true, name: true } } } });
      return { items: rows.map(row => row.user), total: await tx.departmentMembership.count({ where }), page: data.page, pageSize: 20 };
    }
    const where: Prisma.DepartmentWhereInput = {
      ...(data.scope !== 'memberships' ? { active: true } : {}),
      ...(data.scope !== 'destinations' ? { memberships: { some: { userId: actor.id } } } : {})
    };
    const items = await tx.department.findMany({ where, ...paging, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true, active: true } });
    return { items, total: await tx.department.count({ where }), page: data.page, pageSize: 20 };
  }, { isolationLevel: 'RepeatableRead', timeout: 15000 });
}
