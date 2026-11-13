'use client';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createTicketInput, ticketUploadInput, formatTicketNumber } from '@cifradesk/contracts/tickets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Choice, DepartmentChoice, QueryError } from './shared';
import { postTicket, ticketApi, ticketKeys, type OptionPage } from '@/lib/tickets';

export function TicketOpening({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const cache = useQueryClient();
  const [requestedFor, setRequestedFor] = useState('SELF');
  const [origin, setOrigin] = useState('');
  const [departmentId, setDepartment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ id: string; number: number } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const origins = useQuery({ queryKey: ['tickets', userId, 'options', 'origins', 1], queryFn: ({ signal }) => ticketApi<OptionPage>('/api/tickets/options?scope=origins&page=1', { signal }) });
  const originId = origins.data?.total === 1 ? origins.data.items[0]!.id : origin;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget);
    setError(''); setBusy(true);
    let current = created;
    try {
      if (files.length) {
        const check = ticketUploadInput.safeParse({ files: files.map(file => ({ originalName: file.name, mimeType: file.type, size: file.size })) });
        if (!check.success) throw new Error('Envie até cinco arquivos, com no máximo 20 MB cada, nos formatos informados.');
      }
      if (!current) {
        const parsed = createTicketInput.safeParse({ title: form.get('title'), description: form.get('description'), requestedFor, originDepartmentId: originId, departmentId, ...(requestedFor === 'OTHER' ? { requesterName: form.get('requesterName') } : {}) });
        if (!parsed.success) throw new Error('Revise título, descrição, nome e os dois departamentos obrigatórios.');
        current = await postTicket<{ id: string; number: number }>('/api/tickets', parsed.data);
        setCreated(current);
        await cache.invalidateQueries({ queryKey: ticketKeys.all(userId) });
      }
      if (files.length) {
        const body = new FormData(); files.forEach(file => body.append('files', file));
        await ticketApi(`/api/tickets/${current.id}/attachments`, { method: 'POST', body });
      }
      await cache.invalidateQueries({ queryKey: ticketKeys.all(userId) });
      router.push(`/requests/${current.id}`);
    } catch (error) {
      setError((current ? `O chamado ${formatTicketNumber(current.number)} já foi criado. O envio dos anexos não foi confirmado; confira o detalhe antes de reenviar. ` : '') + (error instanceof Error ? error.message : 'Falha de conexão.'));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally { setBusy(false); }
  }
  return <div className="max-w-3xl space-y-6 p-4 md:p-8"><Button asChild variant="outline"><Link href="/requests">Minhas solicitações</Link></Button><h1 className="text-2xl font-semibold">Abrir chamado</h1>
    {origins.isPending && <p role="status">Carregando seus departamentos…</p>}{origins.error && <QueryError error={origins.error} reload={() => void origins.refetch()} />}
    {origins.data?.total === 0 ? <p role="alert">Você não possui vínculo com um departamento ativo. Procure o administrador para abrir chamados.</p> : origins.data && !origins.error && <Card className="p-5">
      <form method="post" onSubmit={submit} className="space-y-5" aria-label="Abertura de chamado" aria-busy={busy}>
        <p ref={errorRef} tabIndex={-1} role="alert">{error}</p>
        {created ? <div className="space-y-3"><p>Chamado {formatTicketNumber(created.number)} criado. A abertura não será repetida.</p><Button asChild><Link href={`/requests/${created.id}`}>Conferir chamado e anexos</Link></Button></div> : <fieldset disabled={busy} className="space-y-5"><legend className="sr-only">Dados obrigatórios do chamado</legend>
          <div className="space-y-2"><Label htmlFor="title">Informe o que deseja? (obrigatório)</Label><Input id="title" name="title" required minLength={5} maxLength={150} /><p className="text-sm text-muted-foreground">De 5 a 150 caracteres.</p></div>
          <div className="space-y-2"><Label htmlFor="description">Descreva sua requisição (obrigatório)</Label><Textarea id="description" name="description" required minLength={10} maxLength={10000} /><p className="text-sm text-muted-foreground">De 10 a 10.000 caracteres, em texto simples.</p></div>
          <Choice id="requestedFor" label="Para quem é o atendimento?" value={requestedFor} onChange={setRequestedFor} options={[{ id: 'SELF', name: 'É para mim' }, { id: 'OTHER', name: 'Para outra pessoa' }]} />
          <div className="space-y-2"><Label htmlFor="requesterName">Informe seu nome completo (obrigatório)</Label>{requestedFor === 'SELF' ? <Input key="self" id="requesterName" value={name} readOnly /> : <Input key="other" id="requesterName" name="requesterName" required minLength={3} maxLength={150} autoComplete="off" />}</div>
          {origins.data.total === 1 ? <div className="space-y-2"><Label htmlFor="origin">Qual seu departamento?</Label><Input id="origin" value={origins.data.items[0]!.name} readOnly /></div> : <DepartmentChoice userId={userId} scope="origins" id="origin" label="Qual seu departamento? (obrigatório)" value={origin} onChange={setOrigin} />}
          <DepartmentChoice userId={userId} scope="destinations" id="destination" label="De qual setor deseja o atendimento? (obrigatório)" value={departmentId} onChange={setDepartment} />
        </fieldset>}
        {!created && <><div className="space-y-2"><Label htmlFor="files">Anexe algum arquivo para ajudar no entendimento do problema</Label><p id="file-help" className="text-sm text-muted-foreground">Opcional: até cinco arquivos de 20 MB. PDF, PNG, JPEG, TXT, CSV, DOCX ou XLSX. Anexos privados.</p><Input id="files" name="files" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.docx,.xlsx" disabled={busy} aria-describedby="file-help" onChange={event => setFiles(Array.from(event.target.files ?? []))} /></div><Button type="submit" disabled={busy}>{busy ? 'Enviando chamado e anexos…' : 'Criar chamado'}</Button></>}
      </form>
    </Card>}
  </div>;
}
