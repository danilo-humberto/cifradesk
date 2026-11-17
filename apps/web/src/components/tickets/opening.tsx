'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { feedback } from '@/lib/feedback';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createTicketInput, ticketUploadInput, formatTicketNumber } from '@cifradesk/contracts/tickets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { DepartmentChoice, QueryError } from './shared';
import { postTicket, ticketApi, ticketKeys, uploadTicketFiles, type OptionPage } from '@/lib/tickets';

import { OpeningFiles, type UploadState } from './opening-files';

const requiredMark = <span className='text-red-400' aria-hidden='true'>*</span>;

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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState<number | null>(null);
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
        setUploadState('uploading'); setProgress(null);
        try {
          await uploadTicketFiles(current.id, body, percent => {
            setProgress(percent); setUploadState(percent === 100 ? 'processing' : 'uploading');
          });
          setUploadState('done');
        } catch (error) { setUploadState('error'); throw error; }
      }
      await cache.invalidateQueries({ queryKey: ticketKeys.all(userId) });
      router.push(`/requests/${current.id}`);
      feedback.success(`Chamado ${formatTicketNumber(current.number)} criado.`);
    } catch (error) {
      const text = (current ? `O chamado ${formatTicketNumber(current.number)} já foi criado. O envio dos anexos não foi confirmado; confira o detalhe antes de reenviar. ` : '') + (error instanceof Error ? error.message : 'Falha de conexão.');
      setError(text); feedback.error(text);
    } finally { setBusy(false); }
  }
  return <div className="mx-auto w-full max-w-3xl space-y-6"><h1 className="text-2xl font-semibold">Abrir chamado</h1>
    {origins.isPending && <p role="status">Carregando seus departamentos…</p>}{origins.error && <QueryError error={origins.error} reload={() => void origins.refetch()} />}
    {origins.data?.total === 0 ? <p role="alert">Você não possui vínculo com um departamento ativo. Procure o administrador para abrir chamados.</p> : origins.data && !origins.error && <Card className="p-5 sm:p-7">
      <form method="post" onSubmit={submit} className="space-y-6 [&_input:not([type=file])]:h-12 [&_[data-slot=select-trigger]]:h-12 [&_input]:md:text-base [&_textarea]:md:text-base" aria-label="Abertura de chamado" aria-describedby={error ? 'opening-error' : undefined} aria-busy={busy}>
        {error && <p id="opening-error" className="feedback-inline-error">{error}</p>}
        {created ? <div className="space-y-3"><p>Chamado {formatTicketNumber(created.number)} criado. A abertura não será repetida.</p><Button asChild><Link href={`/requests/${created.id}`}>Conferir chamado e anexos</Link></Button></div> : <fieldset disabled={busy} className="space-y-5"><legend className="sr-only">Dados obrigatórios do chamado</legend>
          <div className="space-y-2"><Label htmlFor="title">Informe o que deseja? {requiredMark}</Label><div className="relative"><Input id="title" name="title" required minLength={5} maxLength={150} value={title} onChange={event => setTitle(event.target.value)} className="cursor-text! pr-20" aria-describedby="title-count" /><span id="title-count" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs tabular-nums text-muted-foreground"><span className="sr-only">Mínimo de 5 caracteres. </span>{title.length}/150</span></div></div>
          <div className="space-y-2"><Label htmlFor="description">Descreva sua requisição {requiredMark}</Label><div className="relative"><Textarea id="description" name="description" required minLength={10} maxLength={10000} value={description} onChange={event => setDescription(event.target.value)} className="min-h-36 cursor-text! pb-9" aria-describedby="description-count" /><span id="description-count" className="pointer-events-none absolute bottom-3 right-4 text-xs tabular-nums text-muted-foreground"><span className="sr-only">Mínimo de 10 caracteres, em texto simples. </span>{description.length.toLocaleString('pt-BR')}/10.000</span></div></div>
          <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Para quem é o atendimento?</legend><div className="grid grid-cols-2 gap-3">{[{ id: 'SELF', name: 'É para mim' }, { id: 'OTHER', name: 'Para outra pessoa' }].map(option => <Button key={option.id} type="button" className="h-12 cursor-pointer px-2" variant={requestedFor === option.id ? 'default' : 'outline'} aria-pressed={requestedFor === option.id} onClick={() => setRequestedFor(option.id)}>{option.name}</Button>)}</div></fieldset>
          <div className={requestedFor === 'SELF' ? 'cursor-not-allowed space-y-2' : 'space-y-2'}><Label htmlFor="requesterName" className={requestedFor === 'SELF' ? 'cursor-not-allowed' : undefined}>Informe seu nome completo {requiredMark}</Label>{requestedFor === 'SELF' ? <Input key="self" id="requesterName" value={name} disabled /> : <Input key="other" className="cursor-text!" id="requesterName" name="requesterName" required minLength={3} maxLength={150} autoComplete="off" />}</div>
          {origins.data.total === 1 ? <div className="cursor-not-allowed space-y-2"><Label htmlFor="origin" className="cursor-not-allowed">Qual seu departamento?</Label><Input id="origin" value={origins.data.items[0]!.name} disabled /></div> : <DepartmentChoice userId={userId} scope="origins" id="origin" requiredMarker label="Qual seu departamento?" value={origin} onChange={setOrigin} />}
          <DepartmentChoice userId={userId} scope="destinations" id="destination" requiredMarker label="De qual setor deseja o atendimento?" value={departmentId} onChange={setDepartment} />
        </fieldset>}
        <OpeningFiles files={files} onChange={setFiles} disabled={busy || !!created} state={uploadState} progress={progress} />
        {!created && <Button type="submit" className="h-12 w-full cursor-pointer sm:w-auto sm:min-w-44" disabled={busy}>{busy ? 'Abrindo chamado…' : 'Abrir Chamado'}</Button>}
      </form>
    </Card>}
  </div>;
}
