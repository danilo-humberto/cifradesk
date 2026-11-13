import { describe, expect, it, vi, afterEach } from 'vitest';
import { initials, dateOnly, ticketKeys, ticketApi, TicketApiError } from './tickets';

afterEach(() => vi.unstubAllGlobals());
describe('interface de chamados', () => {
  it('preserva acentos e usa primeiro e último nome nos avatares', () => {
    expect(initials('  Ágata de Sá ')).toBe('ÁS');
    expect(initials('Lia')).toBe('L');
  });
  it('exibe vencimento sem converter meia-noite UTC para o dia anterior', () => {
    expect(dateOnly('2026-11-13')).toBe('13/11/2026');
    expect(dateOnly(null)).toBe('Sem prazo');
  });
  it('isola cache por identidade, contexto, página e filtros', () => {
    const key = ticketKeys.list('ana', 'mine', { page: 1 });
    expect(key).not.toEqual(ticketKeys.list('bia', 'mine', { page: 1 }));
    expect(key).not.toEqual(ticketKeys.list('ana', 'queue', { page: 1 }));
    expect(key).not.toEqual(ticketKeys.list('ana', 'mine', { page: 2 }));
    expect(key).not.toEqual(ticketKeys.list('ana', 'mine', { page: 1, status: 'CLOSED' }));
  });
  it('não repete mutação em conflito e preserva status para recarga explícita', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'O chamado mudou.' }), { status: 409 }));
    vi.stubGlobal('fetch', fetch);
    await expect(ticketApi('/api/tickets/id', { method: 'POST', body: '{}' })).rejects.toMatchObject({ status: 409, message: 'O chamado mudou.' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('distingue acesso negado de falha de rede', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })));
    await expect(ticketApi('/api/tickets/id')).rejects.toBeInstanceOf(TicketApiError);
  });
});
