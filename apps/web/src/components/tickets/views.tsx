import Link from 'next/link';
import type { TicketResponse } from '@cifradesk/contracts/tickets';
import { formatTicketNumber } from '@cifradesk/contracts/tickets';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from '@/components/ui/table';
import { dateOnly, dateTime, statusLabels, priorityLabels } from '@/lib/tickets';
import { PersonAvatar } from './shared';

export type TicketView = 'table' | 'list' | 'cards';

function Assignees({ ticket }: { ticket: TicketResponse }) {
  return <div className="space-y-2">
    {ticket.assignees.length ? <div className="flex flex-wrap gap-1">{ticket.assignees.map(person => <PersonAvatar key={person.id} person={person} />)}</div> : <span className="text-muted-foreground">Sem responsável</span>}
    {ticket.needsReassignment && <p className="text-sm font-medium">Reatribuição necessária</p>}
  </div>;
}

function TicketTitle({ ticket }: { ticket: TicketResponse }) {
  return <Link className="rounded-sm font-semibold text-foreground hover:text-primary hover:underline underline-offset-4 [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring" href={`/requests/${ticket.id}`}>
    <span className="mr-2 text-sm font-normal text-muted-foreground">{formatTicketNumber(ticket.number)}</span>{ticket.title}
  </Link>;
}

export function TicketViews({ items, view }: { items: TicketResponse[]; view: TicketView }) {
  if (view === 'table') return <div className="rounded-xl border bg-card p-1">
    <div role="region" aria-label="Tabela de chamados" tabIndex={0} className="overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-ring [&_[data-slot=table-container]]:overflow-visible">
      <Table className="min-w-[1050px]">
        <TableCaption className="pb-3">Chamados · datas em America/Sao_Paulo</TableCaption>
        <TableHeader className="bg-muted/60"><TableRow>{['Título', 'Nome informado', 'Status', 'Responsáveis', 'Criado por', 'Data criada', 'Prioridade', 'Vencimento'].map(label => <TableHead className="px-4" key={label} scope="col">{label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{items.map(ticket => <TableRow key={ticket.id}>
          <TableCell className="min-w-64 max-w-96 px-4 py-5"><TicketTitle ticket={ticket} /><p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">{ticket.department.name}</p></TableCell>
          <TableCell className="min-w-40 max-w-64 px-4 [overflow-wrap:anywhere]">{ticket.requesterName}</TableCell>
          <TableCell className="px-4"><Badge variant="secondary">{statusLabels[ticket.status]}</Badge></TableCell>
          <TableCell className="min-w-40 px-4"><Assignees ticket={ticket} /></TableCell>
          <TableCell className="px-4"><PersonAvatar person={ticket.createdBy} /></TableCell>
          <TableCell className="whitespace-nowrap px-4 text-muted-foreground">{dateTime(ticket.createdAt)}</TableCell>
          <TableCell className="px-4">{priorityLabels[ticket.priority]}</TableCell>
          <TableCell className="whitespace-nowrap px-4 text-muted-foreground">{dateOnly(ticket.dueDate)}</TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </div>
  </div>;

  return <div className="space-y-4">
    <ul role="list" aria-label="Chamados" className={view === 'cards' ? 'grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3' : 'divide-y border-y'}>
      {items.map(ticket => <li key={ticket.id} className="min-w-0">
        <Card className={view === 'cards' ? 'h-full gap-5 shadow-none' : 'gap-4 rounded-none border-0 bg-transparent py-6 shadow-none'}>
          <CardHeader className={view === 'cards' ? 'px-5' : 'px-0'}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="min-w-0 flex-1 text-lg leading-relaxed"><TicketTitle ticket={ticket} /></h2>
              <Badge variant="secondary">{statusLabels[ticket.status]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{ticket.department.name}</p>
          </CardHeader>
          <CardContent className={view === 'cards' ? 'px-5' : 'px-0'}>
            <dl className={`grid gap-x-6 gap-y-4 text-sm ${view === 'cards' ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
              <div className="min-w-0"><dt className="mb-1 text-muted-foreground">Nome informado</dt><dd className="[overflow-wrap:anywhere]">{ticket.requesterName}</dd></div>
              <div><dt className="mb-1 text-muted-foreground">Responsáveis</dt><dd><Assignees ticket={ticket} /></dd></div>
              <div className="min-w-0"><dt className="mb-1 text-muted-foreground">Criado por</dt><dd className="flex items-center gap-2"><PersonAvatar person={ticket.createdBy} /><span className="min-w-0 [overflow-wrap:anywhere]">{ticket.createdBy.name}</span></dd></div>
              <div><dt className="mb-1 text-muted-foreground">Data criada</dt><dd>{dateTime(ticket.createdAt)}</dd></div>
              <div><dt className="mb-1 text-muted-foreground">Prioridade</dt><dd>{priorityLabels[ticket.priority]}</dd></div>
              <div><dt className="mb-1 text-muted-foreground">Vencimento</dt><dd>{dateOnly(ticket.dueDate)}</dd></div>
            </dl>
          </CardContent>
        </Card>
      </li>)}
    </ul>
    <p className="text-center text-sm text-muted-foreground">Chamados · datas em America/Sao_Paulo</p>
  </div>;
}
