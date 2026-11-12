import 'server-only';
import { DomainError } from '@cifradesk/core';
import { z } from 'zod';
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
export function failure(error: unknown) {
  if (error instanceof DomainError) return json({ error: error.message }, error.status);
  if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: 'Revise os dados informados.' }, 400);
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === 'P2002') return json({ error: 'Já existe um cadastro com esses dados.' }, 409);
    if (error.code === 'P2025') return json({ error: 'Registro não encontrado.' }, 404);
  }
  return json({ error: 'Não foi possível concluir. Tente novamente.' }, 500);
}
export function sameOrigin(request: Request) {
  if (request.headers.get('origin') !== new URL(process.env.BETTER_AUTH_URL!).origin)
    throw new DomainError(403, 'Origem não permitida.');
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new DomainError(415, 'Envie JSON.');
}
export async function body(request: Request) {
  // Bound actual bytes, including chunked requests; do not trust Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return {};
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 16384) { await reader.cancel(); throw new DomainError(413, 'Dados muito grandes.'); }
    chunks.push(part.value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
