'use client';

import { useRef, useState } from 'react';
import { FileText, UploadCloud, X } from 'lucide-react';
import { ticketUploadInput } from '@cifradesk/contracts/tickets';
import { Attachment, AttachmentActions, AttachmentAction, AttachmentMedia, AttachmentContent, AttachmentTitle, AttachmentDescription } from '@/components/ui/attachment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';

export type UploadState = 'idle' | 'uploading' | 'processing' | 'error' | 'done';

export function OpeningFiles({ files, onChange, disabled, state, progress }: {
  files: File[]; onChange: (files: File[]) => void; disabled: boolean; state: UploadState; progress: number | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  function select(incoming: File[]) {
    if (disabled) return;
    const next = [...files];
    for (const file of incoming) if (!next.some(existing => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) next.push(file);
    if (next.length && !ticketUploadInput.safeParse({ files: next.map(file => ({ originalName: file.name, mimeType: file.type, size: file.size })) }).success) {
      setError('Selecione até 5 arquivos permitidos, de no máximo 20 MB cada.'); return;
    }
    setError(''); onChange(next);
  }
  const uploading = state === 'uploading' || state === 'processing';
  const status = state === 'processing' ? 'Transferência concluída. Aguardando confirmação do servidor…' : state === 'uploading' ? `Enviando lote de anexos${progress === null ? '…' : `: ${progress}%`}` : state === 'error' ? 'Envio não confirmado. Confira os anexos no detalhe do chamado.' : state === 'done' ? 'Anexos enviados.' : '';
  return <section className="space-y-3" aria-label="Anexos do chamado">
    <Label htmlFor="files">Anexe algum arquivo para ajudar no entendimento do problema</Label>
    {state === 'idle' && <div
      className={`relative flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors focus-within:border-primary ${dragging ? 'border-primary bg-primary/10' : 'border-border bg-muted/20'}`}
      onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={event => { event.preventDefault(); setDragging(false); select(Array.from(event.dataTransfer.files)); }}
    >
      <UploadCloud className="size-8 text-muted-foreground" aria-hidden="true" />
      <div className="space-y-1"><p className="text-sm font-medium">Arraste seus arquivos para cá</p><p id="file-help" className="text-xs leading-relaxed text-muted-foreground">Opcional · até 5 arquivos de 20 MB cada.<br />PDF, PNG, JPEG, TXT, CSV, DOCX ou XLSX · anexos privados.</p></div>
      <Input ref={input} className="sr-only" id="files" name="files" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.docx,.xlsx" disabled={disabled} aria-describedby={error ? 'file-help file-error' : 'file-help'} aria-invalid={!!error} onChange={event => { select(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
      <Button type="button" variant="outline" className="cursor-pointer" disabled={disabled} onClick={() => input.current?.click()}>Selecionar arquivos</Button>
    </div>}
    {error && <p id="file-error" role="alert" className="text-sm text-destructive">{error}</p>}
    {files.length > 0 && <ul className="space-y-2" aria-label="Arquivos selecionados">{files.map((file, index) => <li key={`${file.name}-${file.size}-${file.lastModified}`}>
      <Attachment state={state} className="w-full flex-nowrap">
        <AttachmentMedia>{uploading ? <Spinner aria-hidden="true" /> : <FileText aria-hidden="true" />}</AttachmentMedia>
        <AttachmentContent><AttachmentTitle title={file.name}>{file.name}</AttachmentTitle><AttachmentDescription>{new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(file.size / 1024)} KB · {state === 'idle' ? 'Pronto para enviar' : state === 'error' ? 'Envio não confirmado' : state === 'done' ? 'Enviado' : 'Enviando no lote'}</AttachmentDescription></AttachmentContent>
        {state === 'idle' && <AttachmentActions><AttachmentAction type="button" disabled={disabled} aria-label={`Remover ${file.name}`} onClick={() => { setError(''); onChange(files.filter((_, position) => position !== index)); }}><X aria-hidden="true" /></AttachmentAction></AttachmentActions>}
      </Attachment>
    </li>)}</ul>}
    {uploading && <Progress value={progress} aria-label="Transferência do lote de anexos" />}
    <p role="status" className="text-sm text-muted-foreground">{status}</p>
  </section>;
}
