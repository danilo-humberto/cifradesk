import { z } from 'zod';
import { currentUser, limitAttempts } from '@/lib/server/identity';
import { assertAttachmentAccess, attachmentFiles, uploadAttachments } from '@/lib/server/tickets';
import { failure, json, sameOrigin } from '@/lib/server/http';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request, 'multipart/form-data');
    const user = await currentUser(request.headers);
    const id = z.uuid().parse((await context.params).id);
    await limitAttempts('ticket:upload:' + user.id, 10);
    await assertAttachmentAccess(user, id);
    return json({ items: await uploadAttachments(user, id, await attachmentFiles(request)) }, 201);
  } catch (error) { return failure(error); }
}
