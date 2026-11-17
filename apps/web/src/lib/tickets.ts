import type { TicketStatus, TicketPriority } from '@cifradesk/contracts/tickets';

export const statusLabels: Record<TicketStatus, string> = { OPEN: 'ABERTA', PENDING: 'PENDENTE', IN_PROGRESS: 'EM PROGRESSO', DONE: 'FEITO', REVIEW: 'REVISÃO', BLOCKED: 'BLOCKED', CLOSED: 'FECHADA' };
export const priorityLabels: Record<TicketPriority, string> = { LOW: 'Baixa', NORMAL: 'Normal', HIGH: 'Alta', URGENT: 'Urgente' };
export const ticketKeys = {
  all: (userId: string) => ['tickets', userId] as const,
  list: (userId: string, scope: string, filters: object) => ['tickets', userId, 'list', scope, filters] as const,
  detail: (userId: string, id: string) => ['tickets', userId, 'detail', id] as const
};
export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)?.[0] ?? '' : '')).toLocaleUpperCase('pt-BR');
}
export function dateOnly(value: string | null) { return value ? value.split('-').reverse().join('/') : 'Sem prazo'; }
export function dateTime(value: string) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value)); }
export class TicketApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function ticketApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: 'no-store', ...options });
  if (response.status === 401 && typeof window !== 'undefined') window.location.replace('/login');
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new TicketApiError(response.status, result.error ?? (response.status === 403 ? 'Acesso negado.' : 'Não foi possível concluir. Tente novamente.'));
  return result;
}
export function postTicket<T>(path: string, data: unknown) {
  return ticketApi<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}

// One multipart request: progress measures the whole batch, not individual files.
export function uploadTicketFiles(id: string, body: FormData, onProgress: (percent: number | null) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `/api/tickets/${encodeURIComponent(id)}/attachments`);
    request.timeout = 120000;
    request.upload.onprogress = event => onProgress(event.lengthComputable && event.total > 0 ? Math.min(100, Math.round(event.loaded / event.total * 100)) : null);
    request.onload = () => {
      if (request.status === 401) window.location.replace('/login');
      if (request.status >= 200 && request.status < 300) { resolve(); return; }
      let message = request.status === 403 ? 'Acesso negado.' : 'Não foi possível enviar os anexos.';
      try {
        const result: unknown = JSON.parse(request.responseText);
        if (result && typeof result === 'object' && 'error' in result && typeof result.error === 'string') message = result.error;
      } catch { /* Proxy errors may not contain JSON. */ }
      reject(new TicketApiError(request.status, message));
    };
    request.onerror = () => reject(new Error('Falha de conexão ao enviar anexos.'));
    request.ontimeout = () => reject(new Error('O envio dos anexos excedeu o tempo de espera.'));
    request.onabort = () => reject(new Error('O envio dos anexos foi interrompido.'));
    request.send(body);
  });
}
export type OptionPage = { items: { id: string; name: string; active?: boolean }[]; page: number; pageSize: number; total: number };
