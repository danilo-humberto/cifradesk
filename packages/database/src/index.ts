import { PrismaClient } from '../generated/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
export { Prisma } from '../generated/client/client';
export type { User } from '../generated/client/client';
const globalDatabase = globalThis as unknown as { identityDatabase?: PrismaClient };
export function database() {
  if (!globalDatabase.identityDatabase) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL não configurada.');
    globalDatabase.identityDatabase = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }
  return globalDatabase.identityDatabase;
}
