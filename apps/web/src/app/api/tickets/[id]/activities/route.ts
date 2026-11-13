import { currentUser } from '@/lib/server/identity';
import { listTicketActivities, ticketQuery } from '@/lib/server/tickets';
import { failure, json } from '@/lib/server/http';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser(request.headers);
    return json(await listTicketActivities(user, (await context.params).id, ticketQuery(request)));
  } catch (error) { return failure(error); }
}
