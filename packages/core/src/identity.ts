export class DomainError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export function assertActive(user: { status: string } | null) {
  if (!user || user.status !== 'ACTIVE') throw new DomainError(401, 'Acesso indisponível. Entre novamente.');
}
export function assertAdmin(user: { status: string; isAdmin: boolean } | null) {
  assertActive(user);
  if (!user?.isAdmin) throw new DomainError(403, 'Acesso restrito à administração.');
}
export function assertInvitation(invitation: { expiresAt: Date; usedAt: Date | null; revokedAt: Date | null } | null, now = new Date()) {
  if (!invitation || invitation.usedAt || invitation.revokedAt || invitation.expiresAt <= now)
    throw new DomainError(400, 'Convite inválido ou expirado. Solicite um novo convite ao administrador.');
}
export const canAssign = (status: string, departmentActive: boolean) => status === 'ACTIVE' && departmentActive;
export function assertAdminChange(before: { status: string; isAdmin: boolean }, after: { status: string; isAdmin: boolean }, activeAdmins: number) {
  if (before.status === 'ACTIVE' && before.isAdmin && (after.status !== 'ACTIVE' || !after.isAdmin) && activeAdmins <= 1)
    throw new DomainError(409, 'Mantenha pelo menos um administrador ativo.');
}
