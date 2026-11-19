'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { z } from 'zod';
import type { ticketMessageRevisionListResponse } from '@cifradesk/contracts/tickets';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PaginationFooter } from '@/components/pagination-footer';
import { dateTime, ticketApi } from '@/lib/tickets';
import { QueryError } from './shared';
import { MessageMarkdown } from './message-markdown';

export function MessageRevisions({ userId, ticketId, messageId }: { userId: string; ticketId: string; messageId: string }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button type="button" variant="ghost" className="min-h-12">Versões</Button></DialogTrigger>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Versões da mensagem</DialogTitle><DialogDescription>Versões mais recentes primeiro. Arquivos removidos ficam indisponíveis e continuam ocupando espaço.</DialogDescription></DialogHeader>
      {open && <Revisions userId={userId} ticketId={ticketId} messageId={messageId} />}
    </DialogContent>
  </Dialog>;
}

function Revisions({ userId, ticketId, messageId }: { userId: string; ticketId: string; messageId: string }) {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ['tickets', userId, 'messages', ticketId, 'revisions', messageId, page],
    queryFn: ({ signal }) => ticketApi<z.infer<typeof ticketMessageRevisionListResponse>>(`/api/tickets/${ticketId}/messages/${messageId}/revisions?page=${page}&pageSize=20`, { signal }), retry: false, staleTime: 0, refetchOnMount: 'always' });
  if (query.error) return <QueryError error={query.error} reload={() => void query.refetch()} />;
  if (!query.data) return <p role="status">Carregando versões…</p>;
  return <div className="min-w-0 space-y-5"><ol className="space-y-5">{query.data.items.map(revision => <li key={revision.id} className="min-w-0 space-y-3 border-b pb-4">
    <div className="flex flex-wrap items-center gap-2 text-sm"><h3 className="font-semibold">Versão {revision.version}</h3><time className="text-muted-foreground" dateTime={revision.createdAt}>{dateTime(revision.createdAt)}</time></div>
    <MessageMarkdown>{revision.markdown}</MessageMarkdown>
    {revision.attachments.length > 0 && <ul className="space-y-2 text-sm">{revision.attachments.map(file => <li key={file.id} className="wrap-anywhere">{file.available ? <Button asChild variant="ghost" className="h-auto min-h-12 max-w-full justify-start p-0 text-left whitespace-normal text-primary underline underline-offset-4"><a href={`/api/tickets/${ticketId}/attachments/${file.id}`}>{file.originalName}</a></Button> : <span className="text-muted-foreground">{file.originalName} · Indisponível</span>}</li>)}</ul>}
  </li>)}</ol><PaginationFooter label="Paginação das versões" page={page} total={query.data.total} busy={query.isFetching} onChange={setPage} /></div>;
}
