import { currentUser, listTicketOptions } from '@/lib/server/identity';
import { ticketQuery } from '@/lib/server/tickets';
import { failure, json } from '@/lib/server/http';
export async function GET(request: Request) {
  try { return json(await listTicketOptions(await currentUser(request.headers), ticketQuery(request))); }
  catch (error) { return failure(error); }
}
