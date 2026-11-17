import { TicketDetail } from '@/components/tickets/detail';
import { requireUser } from '@/lib/server/session';
export const metadata = { title: 'Detalhe do chamado' };
export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const [user, { id }] = await Promise.all([requireUser(), params]);
  return <TicketDetail userId={user.id} id={id} />;
}
