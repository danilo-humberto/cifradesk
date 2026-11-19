import { currentUser } from '@/lib/server/identity';
import { listTicketMessageRevisions, ticketQuery } from '@/lib/server/tickets';
import { failure, json } from '@/lib/server/http';

export async function GET(request: Request, context: { params: Promise<{ id: string; messageId: string }> }) {
  try {
    const actor = await currentUser(request.headers);
    const { id, messageId } = await context.params;
    return json(await listTicketMessageRevisions(actor, id, messageId, ticketQuery(request)));
  } catch (error) { return failure(error); }
}
