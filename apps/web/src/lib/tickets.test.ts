import { describe, expect, it, vi, afterEach } from 'vitest';
import { initials, dateOnly, ticketKeys, ticketApi, TicketApiError, uploadTicketFiles } from './tickets';

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

describe('progresso dos anexos', () => {
  function transport() {
    const xhr = { open: vi.fn(), send: vi.fn(), upload: { onprogress: null as null | ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) }, onload: null as null | (() => void), onerror: null as null | (() => void), ontimeout: null as null | (() => void), onabort: null as null | (() => void), status: 201, responseText: '{}', timeout: 0 };
    vi.stubGlobal('XMLHttpRequest', class { constructor() { return xhr; } });
    return xhr;
  }
  it('informa bytes do lote, mas só confirma após resposta do servidor', async () => {
    const xhr = transport(); const progress = vi.fn(); const completed = vi.fn();
    const body = new FormData();
    const pending = uploadTicketFiles('ticket-id', body, progress).then(completed);
    expect(xhr.open).toHaveBeenCalledWith('POST', '/api/tickets/ticket-id/attachments');
    expect(xhr.send).toHaveBeenCalledWith(body);
    xhr.upload.onprogress!({ lengthComputable: true, loaded: 25, total: 100 });
    expect(progress).toHaveBeenLastCalledWith(25);
    xhr.upload.onprogress!({ lengthComputable: true, loaded: 100, total: 100 });
    await Promise.resolve(); expect(completed).not.toHaveBeenCalled();
    xhr.onload!(); await pending; expect(completed).toHaveBeenCalledOnce();
  });
  it('mantém progresso indeterminado quando não há tamanho conhecido', async () => {
    const xhr = transport(); const progress = vi.fn();
    const pending = uploadTicketFiles('id', new FormData(), progress);
    xhr.upload.onprogress!({ lengthComputable: false, loaded: 10, total: 0 });
    expect(progress).toHaveBeenLastCalledWith(null);
    xhr.onload!(); await pending;
  });
  it.each(['http', 'network', 'timeout', 'abort'])('rejeita %s sem repetir o envio', async failure => {
    const xhr = transport();
    const pending = uploadTicketFiles('id', new FormData(), vi.fn());
    const assertion = expect(pending).rejects.toThrow();
    if (failure === 'http') { xhr.status = 413; xhr.responseText = '{"error":"Arquivo muito grande."}'; xhr.onload!(); }
    if (failure === 'network') xhr.onerror!();
    if (failure === 'timeout') xhr.ontimeout!();
    if (failure === 'abort') xhr.onabort!();
    await assertion; expect(xhr.send).toHaveBeenCalledOnce();
  });
});
