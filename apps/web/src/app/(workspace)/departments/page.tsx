import { TicketList } from '@/components/tickets/list';
import { requireUser } from '@/lib/server/session';
export const metadata = { title: 'Setores' };
export default async function Departments() { return <TicketList userId={(await requireUser()).id} scope="queue" />; }
