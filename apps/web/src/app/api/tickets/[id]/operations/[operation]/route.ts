import { ticketOperation } from '@cifradesk/contracts/tickets';
import { currentUser, limitAttempts } from '@/lib/server/identity';
import { operateTicket } from '@/lib/server/tickets';
import { body, failure, json, sameOrigin } from '@/lib/server/http';

export async function POST(request: Request, context: { params: Promise<{ id: string; operation: string }> }) {
  try {
    sameOrigin(request);
    const actor = await currentUser(request.headers);
    const { id, operation } = await context.params;
    const action = ticketOperation.parse(operation);
    await limitAttempts('ticket:operate:' + actor.id, 60);
    return json(await operateTicket(actor, id, action, await body(request, 64 * 1024)));
  } catch (error) { return failure(error); }
}
