'use client';
import { PaginationFooter } from '@/components/pagination-footer';
import Link from 'next/link';
import { useState } from 'react';
import { feedback } from '@/lib/feedback';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { formatTicketNumber, type TicketResponse, type ticketActivityListResponse } from '@cifradesk/contracts/tickets';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { TicketOperations } from './operations';
import { AttachmentUpload } from './attachments';
import { PersonAvatar, QueryError } from './shared';
import { dateOnly, dateTime, statusLabels, priorityLabels, ticketApi, ticketKeys } from '@/lib/tickets';

type Attachments = { items: { id: string; originalName: string; size: number; status: string }[]; total: number; canUpload: boolean };
const actions: Record<string, string> = { 'ticket.created': 'Chamado aberto', 'ticket.updated': 'Dados atualizados', 'ticket.status_changed': 'Status alterado', 'ticket.assigned': 'Responsáveis alterados', 'ticket.transferred': 'Setor alterado', 'ticket.assignees_removed': 'Atribuição removida' };
const fields: Record<string, string> = { title: 'Título', description: 'Descrição', priority: 'Prioridade', dueDate: 'Vencimento', status: 'Status', from: 'Status anterior', previousStatus: 'Status anterior', solution: 'Solução', needsReassignment: 'Reatribuição necessária', assigneeNames: 'Responsáveis', previousAssigneeNames: 'Responsáveis anteriores', departmentName: 'Setor', previousDepartmentName: 'Setor anterior', removedUserName: 'Responsável removido' };
function changeValue(key: string, value: unknown) {
  if (value === null) return 'Removido';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'Nenhum';
  if (typeof value !== 'string') return '';
  if (key === 'dueDate') return dateOnly(value);
  if (['status', 'from', 'previousStatus'].includes(key)) return statusLabels[value as keyof typeof statusLabels] ?? value;
  if (key === 'priority') return priorityLabels[value as keyof typeof priorityLabels] ?? value;
  return value;
}
export function TicketDetail({ userId, id }: { userId: string; id: string }) {
  const cache = useQueryClient();
  const [historyPage, setHistoryPage] = useState(1);
  const [attachmentPage, setAttachmentPage] = useState(1);
  const [editor, setEditor] = useState(0);
  const detail = useQuery({ queryKey: ticketKeys.detail(userId, id), queryFn: ({ signal }) => ticketApi<TicketResponse>(`/api/tickets/${id}`, { signal }), retry: false });
  const history = useQuery({ queryKey: ['tickets', userId, 'history', id, historyPage], queryFn: ({ signal }) => ticketApi<z.infer<typeof ticketActivityListResponse>>(`/api/tickets/${id}/activities?page=${historyPage}&pageSize=20`, { signal }), enabled: !!detail.data && !detail.error });
  const attachments = useQuery({ queryKey: ['tickets', userId, 'attachments', id, attachmentPage], queryFn: ({ signal }) => ticketApi<Attachments>(`/api/tickets/${id}/attachments?page=${attachmentPage}&pageSize=20`, { signal }), enabled: !!detail.data && !detail.error });
  async function refresh() {
    await cache.invalidateQueries({ queryKey: ticketKeys.all(userId) });
    setEditor(value => value + 1); feedback.success('Dados atualizados.');
  }
  const ticket = detail.data;
  return <div className="max-w-5xl space-y-6 p-4 md:p-8"><div className="flex flex-wrap gap-3"><Button asChild variant="outline"><Link href="/requests">Minhas solicitações</Link></Button><Button asChild variant="outline"><Link href="/departments">Fila dos meus setores</Link></Button></div>
    {detail.isPending && <p role="status">Carregando chamado…</p>}
    {detail.error ? <QueryError error={detail.error} reload={() => void detail.refetch()} /> : ticket && <>
      <div className="space-y-3"><h1 className="break-words text-2xl font-semibold">{formatTicketNumber(ticket.number)} · {ticket.title}</h1><div className="flex flex-wrap gap-2"><Badge>{statusLabels[ticket.status]}</Badge><Badge variant="outline">{priorityLabels[ticket.priority]}</Badge><span>{ticket.department.name}</span></div></div>
      <Card className="p-5"><h2 className="text-lg font-semibold">Solicitação</h2><p className="whitespace-pre-wrap break-words">{ticket.description}</p><dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-muted-foreground">Nome informado</dt><dd>{ticket.requesterName}</dd></div><div><dt className="text-muted-foreground">Departamento de origem</dt><dd>{ticket.originDepartmentName}</dd></div><div><dt className="text-muted-foreground">Criado por</dt><dd><PersonAvatar person={ticket.createdBy} /></dd></div><div><dt className="text-muted-foreground">Data criada</dt><dd>{dateTime(ticket.createdAt)}</dd></div><div><dt className="text-muted-foreground">Vencimento</dt><dd>{dateOnly(ticket.dueDate)}</dd></div><div><dt className="text-muted-foreground">Responsáveis</dt><dd className="flex flex-wrap gap-1">{ticket.assignees.length ? ticket.assignees.map(person => <PersonAvatar key={person.id} person={person} />) : 'Sem responsável'}</dd></div></dl>{ticket.needsReassignment && <p role="status">Reatribuição necessária: defina um responsável para continuar o atendimento.</p>}</Card>
      <TicketOperations key={`${id}-${editor}`} userId={userId} ticket={ticket} refresh={refresh} />
      <Card className="p-5"><h2 className="text-lg font-semibold">Anexos privados</h2>{attachments.isPending && <p role="status">Carregando anexos…</p>}{attachments.error ? <QueryError error={attachments.error} reload={() => void attachments.refetch()} /> : attachments.data && <>{attachments.data.items.length === 0 && <p>Nenhum anexo.</p>}<ul className="space-y-3">{attachments.data.items.map(file => <li key={file.id} className="break-words">{file.status === 'AVAILABLE' ? <a className="underline underline-offset-4" href={`/api/tickets/${id}/attachments/${file.id}`}>{file.originalName}</a> : <span>{file.originalName} · {file.status === 'PENDING_UPLOAD' ? 'Envio em processamento' : 'Envio não concluído'}</span>} <span className="text-muted-foreground">({Math.ceil(file.size / 1024)} KB)</span></li>)}</ul><PaginationFooter label="Paginação dos anexos" page={attachmentPage} total={attachments.data.total} busy={attachments.isFetching} onChange={setAttachmentPage} />{attachments.data.canUpload && <AttachmentUpload id={id} refresh={async () => { await cache.invalidateQueries({ queryKey: ['tickets', userId, 'attachments', id] }); }} />}</>}</Card>
      <Card className="p-5"><h2 className="text-lg font-semibold">Histórico</h2>{history.isPending && <p role="status">Carregando histórico…</p>}{history.error ? <QueryError error={history.error} reload={() => void history.refetch()} /> : history.data && <>{history.data.items.length === 0 && <p>Nenhuma atividade disponível.</p>}<ol className="space-y-5">{history.data.items.map(activity => <li key={activity.id} className="space-y-2 border-b pb-4"><div className="flex flex-wrap items-center gap-2"><PersonAvatar person={activity.author} /><h3 className="font-medium">{actions[activity.action.replace(/\.reason$/, '')] ?? 'Chamado atualizado'}</h3><Badge variant="outline">{activity.visibility === 'INTERNAL' ? 'Interno' : 'Compartilhado'}</Badge><time dateTime={activity.createdAt}>{dateTime(activity.createdAt)}</time></div>{activity.reason && <p className="whitespace-pre-wrap break-words">{activity.reason}</p>}{Object.entries(activity.changes).filter(([key]) => key in fields).map(([key, value]) => <p key={key} className="whitespace-pre-wrap break-words"><strong>{fields[key]}:</strong> {changeValue(key, value)}</p>)}</li>)}</ol><PaginationFooter label="Paginação do histórico" page={historyPage} total={history.data.total} busy={history.isFetching} onChange={setHistoryPage} /></>}</Card>
      <Button variant="outline" disabled={detail.isFetching} onClick={() => void refresh()}>Atualizar chamado</Button>
    </>}
  </div>;
}
