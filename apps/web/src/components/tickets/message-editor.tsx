'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { z } from 'zod';
import { ticketUploadInput, type ticketMessageResponse, type ticketMessageRevisionListResponse } from '@cifradesk/contracts/tickets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Attachment, AttachmentContent, AttachmentTitle, AttachmentActions, AttachmentAction } from '@/components/ui/attachment';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { X } from 'lucide-react';
import { feedback } from '@/lib/feedback';
import { ticketApi, TicketApiError } from '@/lib/tickets';
import { MessageMarkdown } from './message-markdown';

export type Message = z.infer<typeof ticketMessageResponse>;
type Revision = z.infer<typeof ticketMessageRevisionListResponse>['items'][number];

export function MessageEditor({ ticketId, message, canSendInternal = false, onSaved, onCancel }: {
  ticketId: string; message?: Message; canSendInternal?: boolean; onSaved: () => Promise<void>; onCancel?: () => void;
}) {
  const id = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const pending = useRef(false);
  const submissionId = useRef<string | null>(null);
  const [markdown, setMarkdown] = useState(message?.markdown ?? '');
  const [visibility, setVisibility] = useState(message?.visibility ?? 'SHARED');
  const [files, setFiles] = useState<File[]>([]);
  const [retained, setRetained] = useState<{ id: string; originalName: string }[]>(message?.attachments ?? []);
  const [expectedVersion, setExpectedVersion] = useState(message?.version ?? 1);
  const [tab, setTab] = useState('write');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [latest, setLatest] = useState<Revision | null>(null);
  const [checking, setChecking] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const locked = busy || (!message && uncertain);
  const internalUnavailable = !message && visibility === 'INTERNAL' && !canSendInternal;
  const path = `/api/tickets/${ticketId}/messages${message ? `/${message.id}` : ''}`;
  const editingId = message?.id;
  useEffect(() => { if (editingId || focusRequest > 0) textarea.current?.focus(); }, [editingId, focusRequest]);

  function validationError(text: string) {
    setError(text); setInvalid(true); setTab('write');
    // The write panel stays mounted so focus can move even from the preview.
    setFocusRequest(value => value + 1);
  }
  function selectFiles(incoming: File[]) {
    const next = [...files, ...incoming];
    if (next.length + retained.length > 5 || (next.length > 0 && !ticketUploadInput.safeParse({ files: next.map(file => ({ originalName: file.name, mimeType: file.type, size: file.size })) }).success)) {
      setError('Selecione até cinco arquivos ativos, de no máximo 20 MB cada, nos formatos permitidos.'); return;
    }
    setError(''); setFiles(next);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || (message && uncertain) || internalUnavailable) return;
    if (!markdown.trim() && !files.length && !retained.length) { validationError('Escreva uma mensagem ou adicione um arquivo.'); return; }
    if (markdown.length > 10000 || files.length + retained.length > 5) { validationError('Use até 10.000 caracteres e cinco arquivos ativos.'); return; }
    pending.current = true; setBusy(true); setError(''); setInvalid(false);
    const body = new FormData();
    body.set('markdown', markdown);
    if (message) {
      body.set('expectedVersion', String(expectedVersion));
      body.set('retainedAttachmentIds', JSON.stringify(retained.map(file => file.id)));
    } else {
      submissionId.current ??= crypto.randomUUID();
      body.set('submissionId', submissionId.current);
      body.set('visibility', visibility);
    }
    files.forEach(file => body.append('files', file));
    try {
      await ticketApi<Message>(path, { method: message ? 'PATCH' : 'POST', body });
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : 'Falha de conexão.';
      // Validation/access failures cannot have published. Uncertain edits always
      // require a read and explicit reconciliation; never advance the version here.
      const ambiguous = !(cause instanceof TicketApiError) || cause.status >= 500 || cause.status === 409;
      setUncertain(ambiguous); setLatest(null);
      if (!ambiguous && !message) submissionId.current = null;
      setError(text + (message && ambiguous ? ' Confira a versão atual antes de salvar novamente. Seu rascunho foi preservado.' : ambiguous ? ' Seu rascunho foi preservado. Repita o mesmo envio para evitar duplicação.' : ' Seu rascunho foi preservado.'));
      setBusy(false); pending.current = false;
      return;
    }
    // A refresh failure must never turn a confirmed write into a retryable write.
    submissionId.current = null; setUncertain(false);
    if (!message) { setMarkdown(''); setFiles([]); setVisibility('SHARED'); setTab('write'); }
    feedback.success(message ? 'Mensagem salva.' : visibility === 'INTERNAL' ? 'Nota interna enviada.' : 'Mensagem enviada.');
    await onSaved().catch(() => feedback.error('Mensagem salva. Atualize o chamado para consultar a conversa.'));
    setBusy(false); pending.current = false;
    setFocusRequest(value => value + 1);
  }
  async function checkCurrent() {
    setChecking(true); setLatest(null);
    try {
      const result = await ticketApi<z.infer<typeof ticketMessageRevisionListResponse>>(`${path}/revisions?page=1&pageSize=1`);
      if (!result.items[0]) throw new Error('Versão indisponível. Atualize a conversa.');
      setLatest(result.items[0]);
    } catch (cause) { setError((cause instanceof Error ? cause.message : 'Falha de conexão.') + ' Seu rascunho foi preservado.'); }
    finally { setChecking(false); }
  }
  return <form action={path} method="post" onSubmit={submit} aria-label={message ? 'Editar mensagem' : 'Nova mensagem'} aria-busy={busy} className="min-w-0 space-y-4 rounded-lg border bg-background p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{message ? 'Editar mensagem' : 'Nova mensagem'}</h3>
      {message ? <p className="text-sm text-muted-foreground">{visibility === 'INTERNAL' ? 'Nota interna' : 'Mensagem compartilhada'} · visibilidade fixa</p> : canSendInternal || visibility === 'INTERNAL' ? <div className="space-y-1"><Label htmlFor={`${id}-visibility`}>Visibilidade</Label><Select name="visibility" value={visibility} disabled={locked} onValueChange={value => setVisibility(value as 'SHARED' | 'INTERNAL')}><SelectTrigger id={`${id}-visibility`} className="min-h-12 w-full sm:w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SHARED">Mensagem compartilhada</SelectItem><SelectItem value="INTERNAL" disabled={!canSendInternal}>Nota interna</SelectItem></SelectContent></Select></div> : <p className="text-sm text-muted-foreground">Mensagem compartilhada</p>}
    </div>
    <p className="text-sm text-muted-foreground">{visibility === 'INTERNAL' ? 'Visível somente para integrantes do setor responsável.' : 'Visível para o solicitante e os integrantes do setor responsável.'}</p>
    {internalUnavailable && <p role="status" className="text-sm text-muted-foreground">Você perdeu acesso às notas internas. Seu rascunho foi preservado. Escolha “Mensagem compartilhada” somente após revisar o que pode ser mostrado ao solicitante.</p>}
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList aria-label="Editor de Markdown" className="group-data-[orientation=horizontal]/tabs:h-14"><TabsTrigger className="min-h-12" value="write">Escrever</TabsTrigger><TabsTrigger className="min-h-12" value="preview">Prévia</TabsTrigger></TabsList>
      <TabsContent value="write" forceMount hidden={tab !== 'write'} className="space-y-2">
        <Label htmlFor={`${id}-markdown`}>Texto da mensagem</Label>
        <Textarea ref={textarea} id={`${id}-markdown`} name="markdown" value={markdown} maxLength={10000} disabled={locked} aria-invalid={invalid} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} className="min-h-36 text-base" onChange={event => { setMarkdown(event.target.value); setInvalid(false); setError(''); }} />
      </TabsContent>
      <TabsContent value="preview" className="min-h-36 rounded-md border p-3">{markdown.trim() ? <MessageMarkdown>{markdown}</MessageMarkdown> : <p className="text-sm text-muted-foreground">{files.length || retained.length ? 'Mensagem somente com arquivos.' : 'Escreva para visualizar a prévia.'}</p>}</TabsContent>
    </Tabs>
    <p id={`${id}-help`} className="text-xs text-muted-foreground">{markdown.length.toLocaleString('pt-BR')}/10.000 caracteres · Markdown: títulos, listas, citações, links e código. HTML e imagens externas não são exibidos.</p>
    <div className="space-y-2"><Label htmlFor={`${id}-files`}>Adicionar arquivos à mensagem</Label><Input id={`${id}-files`} name="files" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.docx,.xlsx" disabled={locked} aria-describedby={`${id}-file-help`} className="min-h-12" onChange={event => { selectFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
      <p id={`${id}-file-help`} className="text-xs text-muted-foreground">Até cinco arquivos ativos, de 20 MB cada. PDF, PNG, JPEG, TXT, CSV, DOCX ou XLSX. Limite de 200 MB por chamado; remover arquivos ou excluir mensagens não libera espaço.</p></div>
    {(files.length > 0 || retained.length > 0) && <ul aria-label="Arquivos da mensagem" className="space-y-2">
      {retained.map(file => <li key={file.id}><Attachment className="w-full flex-nowrap"><AttachmentContent><AttachmentTitle className="wrap-anywhere">{file.originalName}</AttachmentTitle></AttachmentContent><AttachmentActions><AttachmentAction type="button" className="min-h-12 min-w-12" aria-label={`Remover ${file.originalName}`} disabled={locked} onClick={() => setRetained(current => current.filter(item => item.id !== file.id))}><X aria-hidden="true" /></AttachmentAction></AttachmentActions></Attachment></li>)}
      {files.map((file, index) => <li key={index}><Attachment className="w-full flex-nowrap"><AttachmentContent><AttachmentTitle className="wrap-anywhere">{file.name}</AttachmentTitle></AttachmentContent><AttachmentActions><AttachmentAction type="button" className="min-h-12 min-w-12" aria-label={`Remover ${file.name}`} disabled={locked} onClick={() => setFiles(current => current.filter((_, position) => position !== index))}><X aria-hidden="true" /></AttachmentAction></AttachmentActions></Attachment></li>)}
    </ul>}
    {error && <p id={`${id}-error`} role="alert" className="feedback-inline-error">{error}</p>}
    {!message && uncertain && <AlertDialog><AlertDialogTrigger asChild><Button type="button" variant="outline" className="min-h-12" disabled={busy}>Revisar rascunho</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Revisar envio não confirmado?</AlertDialogTitle><AlertDialogDescription>Confira a conversa antes de alterar o rascunho: a mensagem pode já ter sido publicada. Continuar permite editar texto e arquivos; o próximo envio será uma nova mensagem. Para repetir com segurança, use “Tentar o mesmo envio”.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { submissionId.current = null; setUncertain(false); setError(''); }}>Editar como novo envio</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
    {message && uncertain && <div className="space-y-3">
      <Button type="button" variant="outline" className="min-h-12" disabled={checking} onClick={() => void checkCurrent()}>{checking ? 'Consultando versão…' : 'Conferir versão atual'}</Button>
      {latest && <div className="space-y-3 rounded-md border p-3"><p className="text-sm font-medium">Versão publicada {latest.version}</p><MessageMarkdown>{latest.markdown}</MessageMarkdown><ul className="text-sm">{latest.attachments.map(file => <li key={file.id} className="wrap-anywhere">{file.originalName}{!file.available && ' · Indisponível'}</li>)}</ul><p className="text-sm text-muted-foreground">Confira se sua alteração já foi publicada. Ao usar esta base, o texto do rascunho e os novos arquivos serão mantidos; a lista de arquivos existentes será atualizada. Remova novos arquivos que já tenham sido publicados.</p><Button type="button" className="min-h-12 whitespace-normal" onClick={() => { setExpectedVersion(latest.version); setRetained(latest.attachments.filter(file => file.available)); setUncertain(false); setLatest(null); setError(''); }}>Usar versão atual como base</Button></div>}
    </div>}
    <div className="flex flex-wrap gap-2"><Button type="submit" className="min-h-12" disabled={busy || (!!message && uncertain) || internalUnavailable}>{busy ? 'Enviando…' : message ? 'Salvar mensagem' : uncertain ? 'Tentar o mesmo envio' : visibility === 'INTERNAL' ? 'Enviar nota interna' : 'Enviar mensagem'}</Button>{onCancel && <Button type="button" variant="outline" className="min-h-12" disabled={busy} onClick={onCancel}>Cancelar edição</Button>}</div>
    <p role="status" className="text-sm text-muted-foreground">{busy ? 'Publicando mensagem e arquivos juntos…' : ''}</p>
  </form>;
}
