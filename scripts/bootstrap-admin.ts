import { bootstrapAdmin } from '../packages/infrastructure/src/identity';
import { database } from '../packages/database/src';
const args = process.argv.slice(2);
const resend = args[0] === '--resend';
const [email, name] = resend ? args.slice(1) : args;
try {
  if (!email || !name) throw new Error('Uso: bootstrap-admin <email> <nome>');
  const target = new URL(process.env.DATABASE_URL ?? '');
  if (!['postgres', 'localhost', '127.0.0.1', 'identity-postgres'].includes(target.hostname)) throw new Error('Este comando é exclusivamente local.');
  await bootstrapAdmin({ email, name }, resend);
  console.log('Administrador convidado. Consulte o Mailpit local.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Não foi possível criar o convite.');
  process.exitCode = 1;
} finally { await database().$disconnect(); }
