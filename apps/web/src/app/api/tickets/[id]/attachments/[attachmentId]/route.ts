import { z } from 'zod';
import { currentUser, limitAttempts } from '@/lib/server/identity';
import { downloadAttachment } from '@/lib/server/tickets';
import { failure } from '@/lib/server/http';

export async function GET(request: Request, context: { params: Promise<{ id: string; attachmentId: string }> }) {
  try {
    const user = await currentUser(request.headers);
    const params = await context.params;
    const id = z.uuid().parse(params.id);
    const attachmentId = z.uuid().parse(params.attachmentId);
    await limitAttempts('ticket:download:' + user.id, 60);
    const file = await downloadAttachment(user, id, attachmentId);
    return new Response(new Uint8Array(file.bytes), { headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="anexo"; filename*=UTF-8''${encodeURIComponent(file.originalName).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16))}`,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'", 'Referrer-Policy': 'no-referrer'
    } });
  } catch (error) { return failure(error); }
}
