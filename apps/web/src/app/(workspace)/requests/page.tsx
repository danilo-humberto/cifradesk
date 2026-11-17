import { TicketList } from '@/components/tickets/list';
import { requireUser } from '@/lib/server/session';
export const metadata = { title: 'Minhas solicitações' };
export default async function Requests() { return <TicketList userId={(await requireUser()).id} scope="mine" />; }
