'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { z } from 'zod';
import type { ticketListResponse } from '@cifradesk/contracts/tickets';
import { formatTicketNumber } from '@cifradesk/contracts/tickets';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from '@/components/ui/table';
import { Choice, DepartmentChoice, Pages, PersonAvatar, QueryError } from './shared';
import { dateOnly, dateTime, statusLabels, priorityLabels, ticketApi, ticketKeys } from '@/lib/tickets';

export function TicketList({ userId, scope }: { userId: string; scope: 'mine' | 'queue' }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('default');
  const [departmentId, setDepartment] = useState('');
  const filters = { page, pageSize: 20, ...(status !== 'default' ? { status } : {}), ...(departmentId ? { departmentId } : {}) };
  const params = new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)]));
  const query = useQuery({ queryKey: ticketKeys.list(userId, scope, filters), queryFn: ({ signal }) => ticketApi<z.infer<typeof ticketListResponse>>(`/api/tickets/${scope}?${params}`, { signal }) });
  return <div className="min-w-0 space-y-6 p-4 md:p-8">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold">{scope === 'mine' ? 'Minhas solicitações' : 'Fila dos meus setores'}</h1><p className="text-muted-foreground">{scope === 'mine' ? 'Acompanhe os atendimentos que você solicitou.' : 'Organize e atenda as demandas da equipe.'}</p></div><Button asChild><Link href="/requests/new">Abrir chamado</Link></Button></div>
    <search className="grid gap-4 sm:grid-cols-2"><Choice id="status-filter" label="Filtrar por status" value={status} onChange={value => { setStatus(value); setPage(1); }} options={[{ id: 'default', name: 'Todos, exceto FECHADA' }, ...Object.entries(statusLabels).map(([id, name]) => ({ id, name }))]} />
      <DepartmentChoice userId={userId} scope={scope === 'mine' ? 'destinations' : 'memberships'} id="department-filter" label="Filtrar por setor" value={departmentId} onChange={value => { setDepartment(value); setPage(1); }} />
      {departmentId && <Button variant="outline" onClick={() => { setDepartment(''); setPage(1); }}>Limpar setor</Button>}
    </search>
    {query.isPending && <p role="status">Carregando chamados…</p>}
    {query.error ? <QueryError error={query.error} reload={() => void query.refetch()} /> : query.data && <>
      {query.data.items.length === 0 ? <p>Nenhum chamado encontrado para estes filtros.</p> : <Table><TableCaption>Chamados · datas em America/Sao_Paulo</TableCaption><TableHeader><TableRow>{['Título', 'Nome informado', 'Status', 'Responsáveis', 'Criado por', 'Data criada', 'Prioridade', 'Vencimento'].map(label => <TableHead key={label} scope="col">{label}</TableHead>)}</TableRow></TableHeader><TableBody>
        {query.data.items.map(ticket => <TableRow key={ticket.id}>
          <TableCell className="min-w-48 max-w-80 whitespace-normal"><Link className="font-medium underline underline-offset-4 break-words" href={`/requests/${ticket.id}`}>{formatTicketNumber(ticket.number)} · {ticket.title}</Link><p className="text-muted-foreground">{ticket.department.name}</p></TableCell>
          <TableCell>{ticket.requesterName}</TableCell><TableCell><Badge variant="secondary">{statusLabels[ticket.status]}</Badge></TableCell>
          <TableCell><div className="flex flex-wrap gap-1">{ticket.assignees.map(person => <PersonAvatar key={person.id} person={person} />)}</div>{ticket.assignees.length === 0 && <span>Sem responsável</span>}{ticket.needsReassignment && <p className="font-medium">Reatribuição necessária</p>}</TableCell>
          <TableCell><PersonAvatar person={ticket.createdBy} /></TableCell><TableCell className="whitespace-nowrap">{dateTime(ticket.createdAt)}</TableCell><TableCell>{priorityLabels[ticket.priority]}</TableCell><TableCell className="whitespace-nowrap">{dateOnly(ticket.dueDate)}</TableCell>
        </TableRow>)}
      </TableBody></Table>}
      <Pages page={page} total={query.data.total} busy={query.isFetching} onChange={setPage} />
      <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>Atualizar lista</Button>
    </>}
  </div>;
}
