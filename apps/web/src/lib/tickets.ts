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
export type OptionPage = { items: { id: string; name: string; active?: boolean }[]; page: number; pageSize: number; total: number };
