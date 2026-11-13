import { TicketOpening } from '@/components/tickets/opening';
import { requireUser } from '@/lib/server/session';
export const metadata = { title: 'Abrir chamado' };
export default async function NewRequest() { const user = await requireUser(); return <TicketOpening userId={user.id} name={user.name} />; }
