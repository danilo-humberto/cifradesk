import { createHash, randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { database } from '@cifradesk/database';
import { createIdentity, acceptInvitation, updateIdentity, createDepartment, updateDepartment, setMembership, memberOf, bootstrapAdmin, resendInvitation, resetIdentityPassword, currentUser, revokeAll, limitAttempts, signInRequest } from './identity';
import { createAuth } from './auth';
const enabled = process.env.IDENTITY_TEST_DATABASE === '1';
describe.skipIf(!enabled)('identity PostgreSQL integration', () => {
  const db = enabled ? database() : undefined!;
  let adminId: string;
  const password = 'Synthetic-pass-123!';
  async function activeUser(isAdmin = false) {
    const user = await db.user.create({ data: { id: randomUUID(), name: 'Synthetic', email: randomUUID() + '@example.test', isAdmin } });
    const token = randomUUID() + randomUUID();
    await db.invitation.create({ data: { userId: user.id, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 60000) } });
    await acceptInvitation(token, password);
    return db.user.findUniqueOrThrow({ where: { id: user.id } });
  }
  async function login(email: string, suppliedPassword = password) {
    const response = await createAuth().api.signInEmail({ body: { email, password: suppliedPassword }, asResponse: true });
    if (!response.ok) throw new Error('Login rejeitado: ' + response.status);
    const cookie = response.headers.get('set-cookie')?.split(';')[0] ?? '';
    return new Headers({ cookie });
  }
  beforeAll(async () => {
    const target = new URL(process.env.DATABASE_URL!);
    if (target.hostname !== 'identity-postgres' || target.pathname !== '/identity_test') throw new Error('Unsafe test database');
    const admin = await activeUser(true);
    adminId = admin.id;
  });
  afterAll(async () => { await db.$disconnect(); });
  it('rejects duplicate normalized emails and foreign keys', async () => {
    const email = randomUUID() + '@example.test';
    await createIdentity(adminId, { name: 'Person', email });
    await expect(createIdentity(adminId, { name: 'Person', email: ' ' + email.toUpperCase() + ' ' })).rejects.toThrow();
    await expect(db.user.create({ data: { id: randomUUID(), name: 'Invalid case', email: randomUUID() + '@EXAMPLE.TEST' } })).rejects.toThrow();
    await expect(db.departmentMembership.create({ data: { userId: randomUUID(), departmentId: randomUUID() } })).rejects.toThrow();
  });
  it('rejects invite reuse, expiry and concurrent consumption', async () => {
    const user = await createIdentity(adminId, { name: 'Invited', email: randomUUID() + '@example.test' });
    // Synthetic token is never printed or returned by production operations.
    const token = randomUUID() + randomUUID();
    const { createHash } = await import('node:crypto');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await db.invitation.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60000) } });
    const results = await Promise.allSettled([acceptInvitation(token, 'Synthetic-pass-123!'), acceptInvitation(token, 'Synthetic-pass-123!')]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe('ACTIVE');
    expect(await db.account.count({ where: { userId: user.id, providerId: 'credential' } })).toBe(1);
    await expect(acceptInvitation(token, 'Synthetic-pass-123!')).rejects.toThrow();
  });
  it('isolates department membership and immediately removes access', async () => {
    const d = await createDepartment(adminId, { name: 'Finance' });
    const u = await db.user.create({ data: { id: randomUUID(), name: 'Member', email: randomUUID() + '@example.test', status: 'ACTIVE' } });
    expect(await memberOf(u.id, d.id)).toBe(false);
    await setMembership(adminId, d.id, u.id, true);
    await expect(db.departmentMembership.create({ data: { departmentId: d.id, userId: u.id } })).rejects.toThrow();
    expect(await memberOf(u.id, d.id)).toBe(true);
    await setMembership(adminId, d.id, u.id, false);
    expect(await memberOf(u.id, d.id)).toBe(false);
  });
  it('revokes sessions when disabled and never reactivates old sessions', async () => {
    const u = await activeUser();
    await db.session.create({ data: { id: randomUUID(), token: randomUUID(), userId: u.id, expiresAt: new Date(Date.now() + 60000) } });
    await updateIdentity(adminId, u.id, { status: 'DISABLED' });
    expect(await db.session.count({ where: { userId: u.id } })).toBe(0);
    await updateIdentity(adminId, u.id, { status: 'ACTIVE' });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).authVersion).toBe(u.authVersion + 1);
  });
  it('cannot bootstrap again once an administrator exists', async () => {
    await expect(bootstrapAdmin({ name: 'Other', email: randomUUID() + '@example.test' })).rejects.toThrow();
  });
  it('rejects expired and revoked invitations and invalidates previous invitation on resend', async () => {
    const user = await createIdentity(adminId, { name: 'Invited', email: randomUUID() + '@example.test' });
    const first = await db.invitation.findFirstOrThrow({ where: { userId: user.id } });
    await resendInvitation(adminId, user.id);
    expect((await db.invitation.findUniqueOrThrow({ where: { id: first.id } })).revokedAt).not.toBeNull();
    for (const revoked of [false, true]) {
      const token = randomUUID() + randomUUID();
      await db.invitation.create({ data: { userId: user.id, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + (revoked ? 60000 : -1)), revokedAt: revoked ? new Date() : null } });
      await expect(acceptInvitation(token, password)).rejects.toThrow();
    }
  });
  it('issues a seven-day absolute session and rejects revoked versions', async () => {
    const user = await activeUser();
    const headers = await login(user.email);
    expect((await currentUser(headers)).id).toBe(user.id);
    const before = await db.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(before.expiresAt.getTime() - before.createdAt.getTime()).toBeCloseTo(7 * 86400000, -3);
    await currentUser(headers);
    expect((await db.session.findUniqueOrThrow({ where: { id: before.id } })).expiresAt).toEqual(before.expiresAt);
    await db.user.update({ where: { id: user.id }, data: { authVersion: { increment: 1 } } });
    await expect(currentUser(headers)).rejects.toThrow();
    const fresh = await login(user.email);
    await revokeAll(user.id);
    await expect(currentUser(fresh)).rejects.toThrow();
  });
  it('resets password atomically once, revokes sessions and rejects expired reset', async () => {
    const user = await activeUser();
    const headers = await login(user.email);
    let token = '';
    const auth = createAuth(db, value => { token = value; });
    await auth.api.requestPasswordReset({ body: { email: user.email } });
    const record = await db.verification.findFirstOrThrow({ where: { value: user.id } });
    expect(record.expiresAt.getTime() - record.createdAt.getTime()).toBeCloseTo(3600000, -3);
    const result = await Promise.allSettled([resetIdentityPassword(token, 'New-synthetic-123!'), resetIdentityPassword(token, 'New-synthetic-123!')]);
    expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    await expect(currentUser(headers)).rejects.toThrow();
    await expect(login(user.email)).rejects.toThrow();
    expect((await currentUser(await login(user.email, 'New-synthetic-123!'))).id).toBe(user.id);
    await auth.api.requestPasswordReset({ body: { email: user.email } });
    await db.verification.updateMany({ where: { value: user.id }, data: { expiresAt: new Date(0) } });
    await expect(resetIdentityPassword(token, password)).rejects.toThrow();
  });
  it('blocks inactive users and public registration', async () => {
    const invited = await createIdentity(adminId, { name: 'Invited', email: randomUUID() + '@example.test' });
    await expect(updateIdentity(adminId, invited.id, { status: 'ACTIVE' })).rejects.toThrow();
    const user = await activeUser();
    await updateIdentity(adminId, user.id, { status: 'DISABLED' });
    await expect(login(user.email)).rejects.toThrow();
    await expect(createAuth().api.signUpEmail({ body: { name: 'Public', email: randomUUID() + '@example.test', password } })).rejects.toThrow();
    await expect(createDepartment(user.id, { name: 'Denied' })).rejects.toThrow();
  });
  it('department deactivation removes access without deleting membership', async () => {
    const user = await activeUser();
    const department = await createDepartment(adminId, { name: 'Isolated' });
    await setMembership(adminId, department.id, user.id, true);
    await updateDepartment(adminId, department.id, { name: department.name, active: false });
    expect(await memberOf(user.id, department.id)).toBe(false);
    expect(await db.departmentMembership.count({ where: { departmentId: department.id } })).toBe(1);
  });
  it('limits attempts atomically', async () => {
    const key = randomUUID();
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => limitAttempts(key, 3)));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(3);
  });
  it('serializes login against password reset so the old password cannot issue a new session', async () => {
    const user = await activeUser();
    let token = '';
    await createAuth(db, value => { token = value; }).api.requestPasswordReset({ body: { email: user.email } });
    let pending: Promise<Response>;
    await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(724013)`;
      pending = signInRequest(new Request(process.env.BETTER_AUTH_URL + '/api/auth/sign-in/email', {
        method: 'POST', headers: { 'content-type': 'application/json', origin: process.env.BETTER_AUTH_URL! },
        body: JSON.stringify({ email: user.email, password })
      }));
      await expect.poll(async () => {
        const rows = await db.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event = 'advisory'`;
        return Number(rows[0]!.count);
      }, { timeout: 2000 }).toBeGreaterThan(0);
      await createAuth(tx).api.resetPassword({ body: { token, newPassword: 'Changed-before-login-123!' } });
    }, { timeout: 15000 });
    expect((await pending!).status).toBe(401);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });
  it('preserves the last administrator under concurrent demotion', async () => {
    // Dedicated synthetic database only; remove stale admin flags from previous runs.
    await db.user.updateMany({ where: { id: { not: adminId }, isAdmin: true }, data: { isAdmin: false } });
    const second = await activeUser(true);
    const result = await Promise.allSettled([
      updateIdentity(adminId, adminId, { isAdmin: false }),
      updateIdentity(second.id, second.id, { isAdmin: false })
    ]);
    expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.user.count({ where: { status: 'ACTIVE', isAdmin: true } })).toBe(1);
  });
  it('recovers a disabled invitation without granting access before password creation', async () => {
    await db.user.update({ where: { id: adminId }, data: { isAdmin: true } });
    const user = await createIdentity(adminId, { name: 'Recovery', email: randomUUID() + '@example.test' });
    await updateIdentity(adminId, user.id, { status: 'DISABLED' });
    await resendInvitation(adminId, user.id);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe('INVITED');
    expect(await db.account.count({ where: { userId: user.id } })).toBe(0);
    expect(await db.invitation.count({ where: { userId: user.id, revokedAt: null, usedAt: null } })).toBe(1);
  });
  it('bootstrap SMTP failure rolls back and an expired first invitation can be reissued locally', async () => {
    const previous = await db.user.findMany({ where: { isAdmin: true }, select: { id: true } });
    const email = randomUUID() + '@example.test';
    const originalPort = process.env.SMTP_PORT;
    try {
      await db.user.updateMany({ where: { isAdmin: true }, data: { isAdmin: false } });
      process.env.SMTP_PORT = '1';
      await expect(bootstrapAdmin({ name: 'First', email })).rejects.toThrow('nenhuma alteração');
      expect(await db.user.count({ where: { email } })).toBe(0);
      process.env.SMTP_PORT = originalPort;
      const user = await bootstrapAdmin({ name: 'First', email });
      await db.invitation.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(0) } });
      await expect(bootstrapAdmin({ name: 'First', email })).rejects.toThrow();
      await bootstrapAdmin({ name: 'First', email }, true);
      expect(await db.invitation.count({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } } })).toBe(1);
      await expect(bootstrapAdmin({ name: 'Other', email: randomUUID() + '@example.test' }, true)).rejects.toThrow();
    } finally {
      process.env.SMTP_PORT = originalPort;
      await db.user.updateMany({ where: { email }, data: { isAdmin: false } });
      await db.user.updateMany({ where: { id: { in: previous.map(u => u.id) } }, data: { isAdmin: true } });
    }
  });
});
