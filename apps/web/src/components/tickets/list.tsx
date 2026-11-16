'use client';
import { PaginationFooter } from '@/components/pagination-footer';
import Link from 'next/link';
import { useState } from 'react';
import { RefreshCw, Table2, List, LayoutGrid, Inbox, SlidersHorizontal } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { z } from 'zod';
import type { ticketListResponse } from '@cifradesk/contracts/tickets';
import { TicketViews, type TicketView } from './views';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Choice, DepartmentChoice, QueryError } from './shared';
import { statusLabels, ticketApi, ticketKeys } from '@/lib/tickets';

export function TicketList({ userId, scope }: { userId: string; scope: 'mine' | 'queue' }) {
  const [page, setPage] = useState(1);
  const [view, setView] = useState<TicketView>('table');
  const [status, setStatus] = useState('default');
  const [departmentId, setDepartment] = useState('');
  const filters = { page, pageSize: 20, ...(status !== 'default' ? { status } : {}), ...(departmentId ? { departmentId } : {}) };
  const params = new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)]));
  const query = useQuery({ queryKey: ticketKeys.list(userId, scope, filters), queryFn: ({ signal }) => ticketApi<z.infer<typeof ticketListResponse>>(`/api/tickets/${scope}?${params}`, { signal }) });
  return <div className="min-w-0 space-y-6 p-4 md:p-8">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold">{scope === 'mine' ? 'Minhas solicitações' : 'Fila dos meus setores'}</h1><p className="text-muted-foreground">{scope === 'mine' ? 'Acompanhe os atendimentos que você solicitou.' : 'Organize e atenda as demandas da equipe.'}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Tooltip><TooltipTrigger asChild><Button type="button" variant="outline" size="icon" aria-label="Atualizar lista" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw aria-hidden="true" className={query.isFetching ? 'animate-spin motion-reduce:animate-none' : undefined} /></Button></TooltipTrigger><TooltipContent side="bottom">Atualizar lista</TooltipContent></Tooltip>
        <Select value={view} onValueChange={value => { if (value === 'table' || value === 'list' || value === 'cards') setView(value); }}>
          <SelectTrigger aria-label="Visualização dos chamados" className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="table"><Table2 aria-hidden="true" />Tabela</SelectItem>
            <SelectItem value="list"><List aria-hidden="true" />Lista</SelectItem>
            <SelectItem value="cards"><LayoutGrid aria-hidden="true" />Cards</SelectItem>
          </SelectContent>
        </Select>
        <Button asChild><Link href="/requests/new">Abrir chamado</Link></Button>
      </div>
    </div>
    <search aria-label="Filtros dos chamados" className="grid min-w-0 grid-cols-1 gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 [&>div]:min-w-0 [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-trigger]]:bg-background">
      <span className="col-span-full flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground"><SlidersHorizontal className="size-4" aria-hidden="true" />Filtros</span>
      <Choice id="status-filter" label="Filtrar por status" value={status} onChange={value => { setStatus(value); setPage(1); }} options={[{ id: 'default', name: 'Todos, exceto FECHADA' }, ...Object.entries(statusLabels).map(([id, name]) => ({ id, name }))]} />
      <DepartmentChoice userId={userId} scope={scope === 'mine' ? 'destinations' : 'memberships'} id="department-filter" label="Filtrar por setor" value={departmentId} onChange={value => { setDepartment(value); setPage(1); }} />
      {departmentId && <Button className="col-span-full justify-self-end" variant="outline" onClick={() => { setDepartment(''); setPage(1); }}>Limpar setor</Button>}
    </search>
    {query.isPending && <Empty className="min-h-72" role="status"><Spinner className="size-8 text-primary" aria-hidden="true" /><p className="text-sm text-muted-foreground">Carregando chamados…</p></Empty>}
    {query.error ? <QueryError error={query.error} reload={() => void query.refetch()} /> : query.data && <>
      {query.data.items.length === 0 ? <Empty className="min-h-72"><EmptyHeader><EmptyMedia variant="icon" className="size-14 rounded-2xl"><Inbox aria-hidden="true" className="size-7 text-muted-foreground" /></EmptyMedia><EmptyTitle>Nenhum chamado encontrado para estes filtros.</EmptyTitle><EmptyDescription>Altere os filtros ou abra um chamado para começar.</EmptyDescription></EmptyHeader></Empty> : <TicketViews items={query.data.items} view={view} />}
      <PaginationFooter label="Paginação dos chamados" page={page} total={query.data.total} busy={query.isFetching} onChange={setPage} />
    </>}
  </div>;
}
