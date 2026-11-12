import type { HealthResponse } from '@cifradesk/contracts';
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({ status: 'ok', service: 'web' } satisfies HealthResponse, { headers: { 'Cache-Control': 'no-store' } });
}
