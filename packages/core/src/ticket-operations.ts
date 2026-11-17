import { DomainError } from './identity';

export function assertTicketTransition(from: string, to: string, assignees: number, input: { reason?: string; reviewGuidance?: string; solution?: string }) {
  if (from === to) throw new DomainError(400, 'O chamado já está neste status.');
  if ((to === 'BLOCKED' || from === 'CLOSED' || (to === 'CLOSED' && ['OPEN', 'PENDING'].includes(from))) && !input.reason)
    throw new DomainError(400, 'Informe o motivo.');
  if (to === 'REVIEW' && !input.reviewGuidance) throw new DomainError(400, 'Informe o que precisa ser revisto.');
  if (to === 'DONE' && !input.solution) throw new DomainError(400, 'Informe o resumo da solução.');
  if (['IN_PROGRESS', 'REVIEW', 'DONE'].includes(to) && !assignees)
    throw new DomainError(400, 'Atribua pelo menos um responsável elegível.');
}

export function assertTicketDueDate(date: string | null, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  if (date && date < `${part('year')}-${part('month')}-${part('day')}`)
    throw new DomainError(400, 'Escolha hoje ou uma data futura.');
}
