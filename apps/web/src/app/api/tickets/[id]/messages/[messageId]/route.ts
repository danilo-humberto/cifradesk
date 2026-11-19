import { deleteTicketMessageInput } from '@cifradesk/contracts/tickets';
import { currentUser, limitAttempts } from '@/lib/server/identity';
import { deleteTicketMessage, editTicketMessage, messageEditBody } from '@/lib/server/tickets';
import { body, failure, json, sameOrigin } from '@/lib/server/http';

type Context = { params: Promise<{ id: string; messageId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    sameOrigin(request, 'multipart/form-data');
    const actor = await currentUser(request.headers);
    await limitAttempts('ticket:message:' + actor.id, 60);
    const { id, messageId } = await context.params;
    const { data, files } = await messageEditBody(request);
    return json(await editTicketMessage(actor, id, messageId, data, files));
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const actor = await currentUser(request.headers);
    await limitAttempts('ticket:message:' + actor.id, 60);
    const { id, messageId } = await context.params;
    const data = deleteTicketMessageInput.parse(await body(request));
    return json(await deleteTicketMessage(actor, id, messageId, data));
  } catch (error) { return failure(error); }
}
