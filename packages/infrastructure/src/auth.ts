import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import nodemailer from 'nodemailer';
import { database, type Prisma } from '@cifradesk/database';

type Client = ReturnType<typeof database> | Prisma.TransactionClient;
export async function sendMail(to: string, subject: string, text: string) {
  const host = process.env.SMTP_HOST;
  if (!host || !process.env.SMTP_FROM) throw new Error('SMTP local não configurado.');
  await nodemailer.createTransport({
    host, port: Number(process.env.SMTP_PORT ?? 1025), secure: false,
    connectionTimeout: 5000, socketTimeout: 5000
  }).sendMail({ from: process.env.SMTP_FROM, to, subject, text });
}
export function createAuth(client: Client = database(), captureReset?: (token: string) => void) {
  return betterAuth({
    appName: 'CifraDesk',
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: prismaAdapter(client, { provider: 'postgresql', transaction: '$transaction' in client }),
    logger: { disabled: true },
    emailAndPassword: {
      enabled: true, disableSignUp: true, minPasswordLength: 8, maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 3600, revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => {
        if (captureReset) { captureReset(token); return; }
        const current = await client.user.findUnique({ where: { id: user.id } });
        if (current?.status !== 'ACTIVE') return;
        await sendMail(user.email, 'Redefinir senha — CifraDesk',
          'Redefina sua senha em até uma hora: ' + process.env.BETTER_AUTH_URL + '/reset-password#token=' + encodeURIComponent(token));
      },
      onPasswordReset: async ({ user }) => {
        await client.user.update({ where: { id: user.id }, data: { authVersion: { increment: 1 } } });
      }
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, disableSessionRefresh: true, cookieCache: { enabled: false },
      additionalFields: { authVersion: { type: 'number', defaultValue: 0, input: false } }
    },
    user: {
      additionalFields: {
        status: { type: 'string', defaultValue: 'INVITED', input: false },
        isAdmin: { type: 'boolean', defaultValue: false, input: false },
        authVersion: { type: 'number', defaultValue: 0, input: false },
        theme: { type: 'string', defaultValue: 'system', input: false }
      }
    },
    rateLimit: {
      enabled: true, storage: 'database', window: 60, max: 120,
      // The route additionally enforces 10 attempts/email; avoid a shared 3/10s
      // sensitive-route default blocking the whole office behind one proxy.
      customRules: { '/sign-in/email': { window: 60, max: 120 } }
    },
    databaseHooks: {
      session: { create: { before: async (session) => {
        const user = await client.user.findUnique({ where: { id: session.userId } });
        if (user?.status !== 'ACTIVE') throw new APIError('UNAUTHORIZED', { message: 'Credenciais inválidas.' });
        return { data: { ...session, authVersion: user.authVersion } };
      } } }
    }
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export const auth = () => instance ??= createAuth();
