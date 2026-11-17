'use client';
import { useState, type FormEvent } from 'react';
import { feedback } from '@/lib/feedback';
import { ticketUploadInput } from '@cifradesk/contracts/tickets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ticketApi } from '@/lib/tickets';

export function AttachmentUpload({ id, refresh }: { id: string; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget;
    const body = new FormData(form);
    const files = body.getAll('files') as File[];
    setBusy(true); setError('');
    try {
      if (!ticketUploadInput.safeParse({ files: files.map(file => ({ originalName: file.name, mimeType: file.type, size: file.size })) }).success) throw new Error('Selecione de um a cinco arquivos permitidos, com no máximo 20 MB cada.');
      await ticketApi(`/api/tickets/${id}/attachments`, { method: 'POST', body });
      form.reset(); feedback.success('Anexos enviados.');
    } catch (error) {
      const text = (error instanceof Error ? error.message : 'Falha de conexão.') + ' Confira a lista atualizada antes de reenviar, pois o envio pode ter sido concluído.';
      setError(text); feedback.error(text);
    } finally { await refresh(); setBusy(false); }
  }
  return <form method="post" onSubmit={upload} className="space-y-3 border-t pt-4" aria-label="Enviar anexos" aria-describedby={error ? 'attachment-error' : undefined} aria-busy={busy}>
    {error && <p id="attachment-error" className="feedback-inline-error">{error}</p>}
    <Label htmlFor="detail-files">Adicionar ou reenviar anexos</Label><p id="detail-file-help" className="text-sm text-muted-foreground">Confira os arquivos já disponíveis antes de reenviar. Até cinco arquivos de 20 MB por envio; limite total de 200 MB. PDF, PNG, JPEG, TXT, CSV, DOCX ou XLSX.</p>
    <Input id="detail-files" name="files" type="file" multiple required accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.docx,.xlsx" aria-describedby="detail-file-help" disabled={busy} />
    <Button disabled={busy} type="submit">{busy ? 'Enviando anexos…' : 'Enviar anexos'}</Button>
  </form>;
}
