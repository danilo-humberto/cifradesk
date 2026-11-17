import { currentUser } from '@/lib/server/identity';
import { listTickets, ticketQuery } from '@/lib/server/tickets';
import { failure, json } from '@/lib/server/http';

export async function GET(request: Request) {
  try {
    const user = await currentUser(request.headers);
    return json(await listTickets(user, 'queue', ticketQuery(request)));
  } catch (error) { return failure(error); }
}
