import { test as base, expect } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { database } from '../../packages/database/src';
import { acceptInvitation } from '../../packages/infrastructure/src/identity';
export { expect };
export const syntheticPassword = 'Synthetic-e2e-123!';
export const test = base.extend<{ identity: { id: string; email: string } }>({
  identity: [async ({ request, context, baseURL }, use) => {
    const target = new URL(process.env.DATABASE_URL ?? '');
    if (process.env.IDENTITY_TEST_DATABASE !== '1' || target.hostname !== 'identity-postgres' || target.pathname !== '/identity_test')
      throw new Error('E2E requires the isolated synthetic identity database.');
    const db = database();
    const user = await db.user.create({ data: { id: randomUUID(), name: 'E2E Admin', email: randomUUID() + '@example.test', isAdmin: true } });
    const token = randomUUID() + randomUUID();
    await db.invitation.create({ data: { userId: user.id, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 60000) } });
    await acceptInvitation(token, syntheticPassword);
    const response = await request.post('/api/auth/sign-in/email', { headers: { Origin: baseURL! }, data: { email: user.email, password: syntheticPassword } });
    expect(response.status()).toBe(200);
    await context.addCookies((await request.storageState()).cookies);
    await use({ id: user.id, email: user.email });
    await db.user.update({ where: { id: user.id }, data: { isAdmin: false, status: 'DISABLED', authVersion: { increment: 1 } } });
    await db.session.deleteMany({ where: { userId: user.id } });
  }, { auto: true }]
});
