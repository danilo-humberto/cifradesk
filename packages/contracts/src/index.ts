/** Contrato público de liveness. Não representa prontidão das integrações de negócio. */
export type HealthResponse = { status: 'ok'; service: 'web' | 'worker' | 'dispatcher' };
