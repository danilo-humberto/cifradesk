import { currentUser } from '@/lib/server/identity';
import { getTicket } from '@/lib/server/tickets';
import { failure, json } from '@/lib/server/http';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser(request.headers);
    return json(await getTicket(user, (await context.params).id));
  } catch (error) { return failure(error); }
}
