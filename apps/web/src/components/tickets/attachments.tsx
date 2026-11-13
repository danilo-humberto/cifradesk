'use client';
import { useRef, useState, type FormEvent } from 'react';
import { ticketUploadInput } from '@cifradesk/contracts/tickets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ticketApi } from '@/lib/tickets';

export function AttachmentUpload({ id, refresh }: { id: string; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget;
    const body = new FormData(form);
    const files = body.getAll('files') as File[];
    setBusy(true); setError(''); setNotice('');
    try {
      if (!ticketUploadInput.safeParse({ files: files.map(file => ({ originalName: file.name, mimeType: file.type, size: file.size })) }).success) throw new Error('Selecione de um a cinco arquivos permitidos, com no máximo 20 MB cada.');
      await ticketApi(`/api/tickets/${id}/attachments`, { method: 'POST', body });
      form.reset(); setNotice('Anexos enviados.');
    } catch (error) {
      setError((error instanceof Error ? error.message : 'Falha de conexão.') + ' Confira a lista atualizada antes de reenviar, pois o envio pode ter sido concluído.');
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally { await refresh(); setBusy(false); }
  }
  return <form method="post" onSubmit={upload} className="space-y-3 border-t pt-4" aria-label="Enviar anexos" aria-busy={busy}>
    <p ref={errorRef} tabIndex={-1} role="alert">{error}</p><p role="status">{notice}</p>
    <Label htmlFor="detail-files">Adicionar ou reenviar anexos</Label><p id="detail-file-help" className="text-sm text-muted-foreground">Confira os arquivos já disponíveis antes de reenviar. Até cinco arquivos de 20 MB por envio; limite total de 200 MB. PDF, PNG, JPEG, TXT, CSV, DOCX ou XLSX.</p>
    <Input id="detail-files" name="files" type="file" multiple required accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.docx,.xlsx" aria-describedby="detail-file-help" disabled={busy} />
    <Button disabled={busy} type="submit">{busy ? 'Enviando anexos…' : 'Enviar anexos'}</Button>
  </form>;
}
