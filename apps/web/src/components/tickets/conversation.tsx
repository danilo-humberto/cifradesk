'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import type { ticketMessageListResponse } from '@cifradesk/contracts/tickets';
import { MessageSquare, LockKeyhole } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { PaginationFooter } from '@/components/pagination-footer';
import { dateTime, ticketApi, ticketKeys, TicketApiError } from '@/lib/tickets';
import { feedback } from '@/lib/feedback';
import { PersonAvatar, QueryError } from './shared';
import { MessageEditor, type Message } from './message-editor';
import { MessageMarkdown } from './message-markdown';
import { MessageRevisions } from './message-revisions';

export function TicketConversation({ userId, ticketId }: { userId: string; ticketId: string }) {
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Message | null>(null);
  const editTrigger = useRef<HTMLButtonElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (!editing && restoreFocus.current) {
      restoreFocus.current = false;
      if (editTrigger.current?.isConnected && !editTrigger.current.disabled) editTrigger.current.focus();
      else heading.current?.focus();
    }
  }, [editing]);
  const query = useQuery({ queryKey: ['tickets', userId, 'messages', ticketId, page],
    queryFn: ({ signal }) => ticketApi<z.infer<typeof ticketMessageListResponse>>(`/api/tickets/${ticketId}/messages?page=${page}&pageSize=20`, { signal }), retry: false });
  const denied = query.error instanceof TicketApiError && [401, 403, 404].includes(query.error.status);
  const data = denied ? undefined : query.data;
  const unavailableEditing = editing && data && (!data.canSend || (editing.visibility === 'INTERNAL' && !data.canSendInternal));
  async function refresh(created = false) {
    if (created) setPage(1);
    await cache.invalidateQueries({ queryKey: ticketKeys.all(userId) });
  }
  function closeEditor() {
    restoreFocus.current = true;
    setEditing(null);
  }
  return <Card className="min-w-0 p-4 sm:p-5"><section aria-label="Conversa do chamado" className="min-w-0 space-y-5">
    <div className="flex items-center gap-2"><MessageSquare className="size-5 text-muted-foreground" aria-hidden="true" /><h2 ref={heading} tabIndex={-1} className="text-lg font-semibold">Conversa</h2></div>
    <p className="text-sm text-muted-foreground">Mensagens mais recentes primeiro. Use “Atualizar chamado” para buscar novas mensagens.</p>
    {query.isPending && <p role="status">Carregando conversa…</p>}
    {query.error ? <QueryError error={query.error} reload={() => void query.refetch()} /> : data && <>
      {data.items.length === 0 && <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Nenhuma mensagem. Use a conversa para acompanhar o atendimento.</p>}
      <ol className="space-y-4">{data.items.map(message => <li key={message.id}><article className={`min-w-0 space-y-3 rounded-lg border p-4 ${message.visibility === 'INTERNAL' ? 'border-dashed bg-muted/50' : 'bg-background'}`}>
        <header className="flex flex-wrap items-center gap-2 text-sm"><PersonAvatar person={message.author} /><span className="font-medium">{message.author.name}</span><Badge variant="outline">{message.visibility === 'INTERNAL' && <LockKeyhole aria-hidden="true" className="mr-1 size-3" />}{message.visibility === 'INTERNAL' ? 'Nota interna' : 'Mensagem compartilhada'}</Badge><time className="text-xs text-muted-foreground" dateTime={message.createdAt}>{dateTime(message.createdAt)}</time>{message.version > 1 && !message.deletedAt && <span className="text-xs text-muted-foreground" title={`Última edição: ${dateTime(message.updatedAt)}`}>Editada</span>}</header>
        {message.deletedAt ? <p className="text-sm italic text-muted-foreground">Mensagem excluída.</p> : <>
          <MessageMarkdown>{message.markdown ?? ''}</MessageMarkdown>
          {message.attachments.length > 0 && <ul className="space-y-1 text-sm" aria-label="Anexos da mensagem">{message.attachments.map(file => <li key={file.id} className="wrap-anywhere"><Button asChild variant="ghost" className="h-auto min-h-12 max-w-full justify-start p-0 text-left whitespace-normal text-primary underline underline-offset-4"><a href={`/api/tickets/${ticketId}/attachments/${file.id}`}>{file.originalName}</a></Button><span className="text-xs text-muted-foreground"> · {Math.ceil(file.size / 1024)} KB</span></li>)}</ul>}
          <div className="flex flex-wrap gap-1">{message.canEdit && <Button type="button" variant="ghost" className="min-h-12" disabled={!!editing} onClick={event => { editTrigger.current = event.currentTarget; setEditing(message); }}>Editar</Button>}{message.canViewRevisions && <MessageRevisions userId={userId} ticketId={ticketId} messageId={message.id} />}{message.canDelete && <DeleteMessage message={message} disabled={!!editing} refresh={() => refresh()} />}</div>
        </>}
      </article></li>)}</ol>
      <PaginationFooter label="Paginação da conversa" page={page} total={data.total} busy={query.isFetching || !!editing} onChange={setPage} />
    </>}
    {data && !data.canSend && <p role="status" className="text-sm text-muted-foreground">Setor desativado: conversa disponível somente para leitura.</p>}
    {unavailableEditing && <div className="space-y-2"><p role="status" className="text-sm text-muted-foreground">Esta mensagem não pode mais ser editada. Encerre a edição para continuar navegando na conversa.</p><Button type="button" variant="outline" className="min-h-12" onClick={closeEditor}>Encerrar edição</Button></div>}
    {data?.canSend && <>
      {editing && (editing.visibility !== 'INTERNAL' || data.canSendInternal) && <MessageEditor key={editing.id} ticketId={ticketId} message={editing} onSaved={async () => { await refresh(); closeEditor(); }} onCancel={() => { closeEditor(); void refresh(); }} />}
      <MessageEditor ticketId={ticketId} canSendInternal={data.canSendInternal} onSaved={() => refresh(true)} />
    </>}
  </section></Card>;
}

function DeleteMessage({ message, disabled, refresh }: { message: Message; disabled: boolean; refresh: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [expectedVersion, setExpectedVersion] = useState(message.version);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  async function remove() {
    if (pending.current || error) return;
    pending.current = true; setBusy(true);
    try {
      await ticketApi(`/api/tickets/${message.ticketId}/messages/${message.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedVersion }) });
    } catch (cause) {
      setError((cause instanceof Error ? cause.message : 'Falha de conexão.') + ' Confira a conversa antes de tentar novamente.');
      pending.current = false; setBusy(false); return;
    }
    feedback.success('Mensagem excluída.');
    await refresh().catch(() => feedback.error('Mensagem excluída. Atualize o chamado para consultar a conversa.'));
    setOpen(false); pending.current = false; setBusy(false);
  }
  return <AlertDialog open={open} onOpenChange={value => { if (busy) return; if (value) { setExpectedVersion(message.version); setError(''); } setOpen(value); }}>
    <AlertDialogTrigger asChild><Button type="button" variant="ghost" className="min-h-12 text-destructive" disabled={disabled}>Excluir</Button></AlertDialogTrigger>
    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir mensagem?</AlertDialogTitle><AlertDialogDescription>O conteúdo, as versões e os arquivos ficarão indisponíveis. Um marcador será mantido na conversa. Os arquivos continuam ocupando espaço.</AlertDialogDescription></AlertDialogHeader>
      {error && <p role="alert" className="feedback-inline-error">{error}</p>}
      <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>{error ? <Button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await refresh(); setOpen(false); } finally { setBusy(false); } }}>Conferir conversa</Button> : <AlertDialogAction disabled={busy} onClick={event => { event.preventDefault(); void remove(); }}>{busy ? 'Excluindo…' : 'Excluir mensagem'}</AlertDialogAction>}</AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
