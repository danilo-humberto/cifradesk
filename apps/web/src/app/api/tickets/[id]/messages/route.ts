import { currentUser, limitAttempts } from '@/lib/server/identity';
import { createTicketMessage, listTicketMessages, messageBody, ticketQuery } from '@/lib/server/tickets';
import { failure, json, sameOrigin } from '@/lib/server/http';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await currentUser(request.headers);
    return json(await listTicketMessages(actor, (await context.params).id, ticketQuery(request)));
  } catch (error) { return failure(error); }
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request, 'multipart/form-data');
    const actor = await currentUser(request.headers);
    await limitAttempts('ticket:message:' + actor.id, 60);
    const { data, files } = await messageBody(request);
    return json(await createTicketMessage(actor, (await context.params).id, data, files), 201);
  } catch (error) { return failure(error); }
}
