import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { database, type Prisma } from '@cifradesk/database';
import { assertActive, assertAdmin, assertInvitation, assertAdminChange, canAssign, DomainError } from '@cifradesk/core';
import { inviteInput, updateUserInput, departmentInput, acceptInput } from '@cifradesk/contracts/identity';
import { auth, createAuth, sendMail } from './auth';

export const publicUser = { id: true, name: true, email: true, emailVerified: true, status: true, isAdmin: true, theme: true } as const;
type Tx = Prisma.TransactionClient;
// Serialize identity mutations, including bootstrap and final-admin checks.
// A transaction-scoped database lock also works across web processes.
async function write<T>(operation: (tx: Tx) => Promise<T>) {
  return database().$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(724013)`;
    return operation(tx);
  }, { timeout: 15000 });
}
async function administrator(tx: Tx, actorId: string) {
  assertAdmin(await tx.user.findUnique({ where: { id: actorId } }));
}
export async function currentUser(headers: Headers) {
  const session = await auth().api.getSession({ headers });
  if (!session) throw new DomainError(401, 'Entre para continuar.');
  const user = await database().user.findUnique({ where: { id: session.user.id } });
  assertActive(user);
  if (!user || user.authVersion !== session.session.authVersion) throw new DomainError(401, 'Sessão encerrada. Entre novamente.');
  return user;
}
function invitationData(userId: string) {
  const token = randomBytes(32).toString('hex');
  return { token, data: { userId, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 48 * 3600000) } };
}
async function deliver(email: string, token: string) {
  try {
    await sendMail(email, 'Convite — CifraDesk', 'Defina sua senha em até 48 horas: ' + process.env.BETTER_AUTH_URL + '/accept-invitation#token=' + encodeURIComponent(token));
  } catch {
    throw new DomainError(503, 'Cadastro preservado, mas o e-mail não foi enviado. Use Reenviar convite.');
  }
}
export async function createIdentity(actorId: string, input: unknown) {
  const data = inviteInput.parse(input);
  const result = await write(async tx => {
    await administrator(tx, actorId);
    const user = await tx.user.create({ data: { ...data, id: randomUUID() }, select: publicUser });
    const invitation = invitationData(user.id);
    await tx.invitation.create({ data: invitation.data });
    return { user, token: invitation.token };
  });
  await deliver(result.user.email, result.token);
  return result.user;
}
export async function bootstrapAdmin(input: unknown, resend = false) {
  const data = inviteInput.parse(input);
  return write(async tx => {
    const existing = await tx.user.findMany({ where: { isAdmin: true }, take: 2 });
    if (existing.length && !(resend && existing.length === 1 && existing[0]!.status === 'INVITED' && existing[0]!.email === data.email))
      throw new DomainError(409, 'Já existe administrador. Reenvio local somente para o primeiro administrador ainda convidado.');
    const user = existing[0] ?? await tx.user.create({ data: { ...data, id: randomUUID(), isAdmin: true }, select: publicUser });
    await tx.invitation.updateMany({ where: { userId: user.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    const invitation = invitationData(user.id);
    await tx.invitation.create({ data: invitation.data });
    // For bootstrap, SMTP failure rolls back the account so the command remains retryable.
    try { await sendMail(user.email, 'Convite — CifraDesk', 'Defina sua senha em até 48 horas: ' + process.env.BETTER_AUTH_URL + '/accept-invitation#token=' + invitation.token); }
    catch { throw new DomainError(503, 'E-mail não enviado; nenhuma alteração foi aplicada. Verifique o Mailpit e repita o comando.'); }
    return { id: user.id, email: user.email };
  });
}
export async function resendInvitation(actorId: string, userId: string) {
  const result = await write(async tx => {
    await administrator(tx, actorId);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const credential = await tx.account.count({ where: { userId, providerId: 'credential', password: { not: null } } });
    if (user.status !== 'INVITED' && !(user.status === 'DISABLED' && !credential)) throw new DomainError(409, 'Contas que já definiram senha devem usar recuperação de acesso.');
    if (user.status === 'DISABLED') await tx.user.update({ where: { id: userId }, data: { status: 'INVITED' } });
    await tx.invitation.updateMany({ where: { userId, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    const invitation = invitationData(userId);
    await tx.invitation.create({ data: invitation.data });
    return { email: user.email, token: invitation.token };
  });
  await deliver(result.email, result.token);
}
export async function acceptInvitation(token: string, password: string) {
  acceptInput.parse({ token, password });
  await write(async tx => {
    const invitation = await tx.invitation.findUnique({ where: { tokenHash: createHash('sha256').update(token).digest('hex') } });
    assertInvitation(invitation);
    const user = await tx.user.findUniqueOrThrow({ where: { id: invitation!.userId } });
    if (user.status !== 'INVITED') throw new DomainError(400, 'Convite inválido ou expirado.');
    // The library owns credential creation/hashing; all calls use this same transaction.
    let resetToken: string | undefined;
    const localAuth = createAuth(tx, token => { resetToken = token; });
    await localAuth.api.requestPasswordReset({ body: { email: user.email } });
    if (!resetToken) throw new Error('Não foi possível preparar a senha.');
    await localAuth.api.resetPassword({ body: { token: resetToken, newPassword: password } });
    await tx.user.update({ where: { id: user.id }, data: { status: 'ACTIVE', emailVerified: true } });
    await tx.invitation.update({ where: { id: invitation!.id }, data: { usedAt: new Date() } });
    await tx.invitation.updateMany({ where: { userId: user.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  });
}
export async function updateIdentity(actorId: string, id: string, input: unknown) {
  const patch = updateUserInput.parse(input);
  return write(async tx => {
    await administrator(tx, actorId);
    const before = await tx.user.findUniqueOrThrow({ where: { id } });
    if (patch.status === 'ACTIVE' && !await tx.account.count({ where: { userId: id, providerId: 'credential' } }))
      throw new DomainError(409, 'A conta precisa aceitar um convite antes de ser ativada.');
    const after = { ...before, ...patch };
    assertAdminChange(before, after, await tx.user.count({ where: { status: 'ACTIVE', isAdmin: true } }));
    if (patch.status === 'DISABLED') {
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.invitation.updateMany({ where: { userId: id, usedAt: null }, data: { revokedAt: new Date() } });
      await tx.verification.deleteMany({ where: { value: id } });
    }
    return tx.user.update({ where: { id }, data: { ...patch, ...(patch.status === 'DISABLED' ? { authVersion: { increment: 1 } } : {}) }, select: publicUser });
  });
}
export async function createDepartment(actorId: string, input: unknown) {
  const data = departmentInput.parse(input);
  return write(async tx => { await administrator(tx, actorId); return tx.department.create({ data }); });
}
export async function updateDepartment(actorId: string, id: string, input: unknown) {
  const data = departmentInput.parse(input);
  return write(async tx => { await administrator(tx, actorId); return tx.department.update({ where: { id }, data }); });
}
export async function setMembership(actorId: string, departmentId: string, userId: string, present: boolean) {
  await write(async tx => {
    await administrator(tx, actorId);
    if (!present) { await tx.departmentMembership.deleteMany({ where: { departmentId, userId } }); return; }
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const department = await tx.department.findUniqueOrThrow({ where: { id: departmentId } });
    if (!canAssign(user.status, department.active)) throw new DomainError(409, 'Selecione usuário e setor ativos.');
    await tx.departmentMembership.upsert({ where: { userId_departmentId: { userId, departmentId } }, create: { userId, departmentId }, update: {} });
  });
}
export async function memberOf(userId: string, departmentId: string) {
  return (await database().departmentMembership.count({ where: { userId, departmentId, user: { status: 'ACTIVE' }, department: { active: true } } })) > 0;
}
export async function revokeAll(userId: string) {
  await write(async tx => {
    assertActive(await tx.user.findUnique({ where: { id: userId } }));
    await tx.user.update({ where: { id: userId }, data: { authVersion: { increment: 1 } } });
    await tx.session.deleteMany({ where: { userId } });
  });
}
export async function listUsers(page: number) {
  const [items, total] = await database().$transaction([
    database().user.findMany({ select: publicUser, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 20, skip: (page - 1) * 20 }),
    database().user.count()
  ]);
  return { items, total, page };
}
export async function listDepartments(page: number) {
  const [items, total] = await database().$transaction([
    database().department.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 20, skip: (page - 1) * 20 }),
    database().department.count()
  ]);
  return { items, total, page };
}
export async function listMembers(departmentId: string, page: number) {
  const where = { departmentId };
  const [rows, total] = await database().$transaction([
    database().departmentMembership.findMany({ where, select: { user: { select: publicUser } }, orderBy: { userId: 'asc' }, take: 20, skip: (page - 1) * 20 }),
    database().departmentMembership.count({ where })
  ]);
  return { items: rows.map(row => row.user), total, page };
}
export async function saveTheme(userId: string, theme: 'system' | 'light' | 'dark') {
  await database().user.update({ where: { id: userId, status: 'ACTIVE' }, data: { theme } });
}

export async function limitAttempts(key: string, max: number) {
  const digest = createHash('sha256').update(key).digest('hex');
  const now = BigInt(Date.now());
  await database().rateLimit.deleteMany({ where: { lastRequest: { lt: now - 3600000n } } });
  const rows = await database().$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" (id, key, count, "lastRequest") VALUES (${randomUUID()}, ${digest}, 1, ${now})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN "RateLimit"."lastRequest" < ${now - 60000n} THEN 1 ELSE "RateLimit".count + 1 END,
      "lastRequest" = CASE WHEN "RateLimit"."lastRequest" < ${now - 60000n} THEN ${now} ELSE "RateLimit"."lastRequest" END
    RETURNING count`;
  if (rows[0]!.count > max) throw new DomainError(429, 'Muitas tentativas. Aguarde um minuto.');
}
export async function resetIdentityPassword(token: string, password: string) {
  await write(async tx => {
    const verification = await tx.verification.findFirst({ where: { identifier: 'reset-password:' + token, expiresAt: { gt: new Date() } } });
    const user = verification ? await tx.user.findUnique({ where: { id: verification.value } }) : null;
    if (!user || user.status !== 'ACTIVE') throw new DomainError(400, 'Link inválido ou expirado. Solicite outro.');
    await createAuth(tx).api.resetPassword({ body: { token, newPassword: password } });
    await tx.verification.deleteMany({ where: { value: user.id } });
  });
}

export const signInRequest = (request: Request) => write(tx => createAuth(tx).handler(request));
