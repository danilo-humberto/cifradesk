import { currentUser, limitAttempts } from '@/lib/server/identity';
import { createTicket } from '@/lib/server/tickets';
import { body, failure, json, sameOrigin } from '@/lib/server/http';

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await currentUser(request.headers);
    await limitAttempts('ticket:create:' + user.id, 30);
    return json(await createTicket(user, await body(request, 64 * 1024)), 201);
  } catch (error) { return failure(error); }
}
