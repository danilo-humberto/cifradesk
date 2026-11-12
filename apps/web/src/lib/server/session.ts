import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { currentUser } from './identity';
import { DomainError } from '@cifradesk/core';
export async function requireUser() {
  try { return await currentUser(await headers()); }
  catch (error) { if (error instanceof DomainError && error.status === 401) redirect('/login'); throw error; }
}
