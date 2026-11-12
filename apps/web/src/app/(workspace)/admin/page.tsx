import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/server/session';
import { AdminPanel } from '@/components/admin-panel';
export const metadata = { title: 'Administração' };
export default async function AdminPage() {
  const user = await requireUser();
  if (!user.isAdmin) redirect('/');
  return <><div className="page-heading"><h1>Administração</h1><p>Organize as pessoas e os setores da equipe.</p></div><AdminPanel /></>;
}
