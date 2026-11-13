'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TicketResponse, TicketStatus, TicketPriority } from '@cifradesk/contracts/tickets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Choice, DepartmentChoice, Pages, QueryError } from './shared';
import { postTicket, ticketApi, TicketApiError, statusLabels, priorityLabels, type OptionPage } from '@/lib/tickets';

export function TicketOperations({ userId, ticket, refresh }: { userId: string; ticket: TicketResponse; refresh: () => Promise<void> }) {
  // Freeze the editing baseline: background refetch must never advance expectedVersion.
  const [baseline] = useState(ticket);
  const [operation, setOperation] = useState('status');
  const [status, setStatus] = useState<TicketStatus>(baseline.status);
  const [priority, setPriority] = useState<TicketPriority>(baseline.priority);
  const [departmentId, setDepartment] = useState('');
  const [assigned, setAssigned] = useState(baseline.assignees.map(person => person.id));
  const [memberPage, setMemberPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const members = useQuery({ queryKey: ['tickets', userId, 'members', ticket.department.id, memberPage], queryFn: ({ signal }) => ticketApi<OptionPage>(`/api/tickets/options?scope=members&departmentId=${ticket.department.id}&page=${memberPage}`, { signal }), retry: false });
  const needsReason = operation === 'transfer' || operation === 'reopen' || (operation === 'status' && (status === 'BLOCKED' || (baseline.status === 'CLOSED' && status !== 'CLOSED') || (status === 'CLOSED' && ['OPEN', 'PENDING'].includes(baseline.status))));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || conflict) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    const data: Record<string, unknown> = { expectedVersion: baseline.version };
    if (operation === 'status') {
      data.status = status;
      if (status === 'REVIEW') data.reviewGuidance = form.get('reviewGuidance');
      if (status === 'DONE') data.solution = form.get('solution');
    }
    if (needsReason) data.reason = form.get('reason');
    if (operation === 'transfer') data.departmentId = departmentId;
    if (operation === 'assign') data.userIds = assigned;
    if (operation === 'update') {
      data.title = form.get('title'); data.description = form.get('description'); data.priority = priority;
      const dueDate = String(form.get('dueDate') ?? '') || null;
      // Preserve overdue deadlines when the user only changes another field.
      if (dueDate !== baseline.dueDate) data.dueDate = dueDate;
    }
    try { await postTicket(`/api/tickets/${ticket.id}/operations/${operation}`, data); await refresh(); }
    catch (error) {
      setConflict(error instanceof TicketApiError && error.status === 409);
      setError(error instanceof Error ? error.message : 'Falha de conexão.');
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally { setBusy(false); }
  }
  if (members.isPending) return <p role="status">Verificando ações disponíveis…</p>;
  if (members.error instanceof TicketApiError && [403, 404].includes(members.error.status)) return <p className="text-muted-foreground">Você pode acompanhar este chamado. O atendimento é feito pelos integrantes ativos do setor.</p>;
  if (members.error) return <QueryError error={members.error} reload={() => void members.refetch()} />;
  const options = [{ id: 'status', name: 'Alterar status' }, { id: 'assign', name: 'Definir responsáveis' }, { id: 'update', name: 'Editar dados, prioridade e prazo' }, ...(!['DONE', 'CLOSED'].includes(baseline.status) ? [{ id: 'transfer', name: 'Transferir setor' }] : []), ...(baseline.status === 'CLOSED' ? [{ id: 'reopen', name: 'Reabrir chamado' }] : [])];
  return <Card className="p-5"><h2 className="text-lg font-semibold">Atendimento</h2>
    <p ref={errorRef} tabIndex={-1} role="alert">{error}</p>
    {(conflict || baseline.version !== ticket.version) && <div className="space-y-3"><p>O chamado mudou. Recarregue para revisar os dados atuais. Seu rascunho será descartado; nada será reenviado automaticamente.</p><Button type="button" disabled={busy} onClick={() => void refresh()}>Recarregar chamado</Button></div>}
    <form method="post" onSubmit={submit} aria-label="Atendimento do chamado" className="space-y-4" aria-busy={busy}>
      <fieldset disabled={busy || conflict || baseline.version !== ticket.version} className="space-y-4"><legend className="sr-only">Operação e dados do atendimento</legend>
        <Choice id="operation" label="Ação" value={operation} onChange={setOperation} options={options} />
        {operation === 'status' && <><Choice id="new-status" label="Novo status" value={status} onChange={value => setStatus(value as TicketStatus)} options={Object.entries(statusLabels).map(([id, name]) => ({ id, name }))} />{['IN_PROGRESS', 'REVIEW', 'DONE'].includes(status) && baseline.assignees.length === 0 && <p>Defina pelo menos um responsável antes de entrar neste status.</p>}
          {status === 'REVIEW' && <div className="space-y-2"><Label htmlFor="reviewGuidance">O que precisa ser revisto? (interno, obrigatório)</Label><Textarea id="reviewGuidance" name="reviewGuidance" required maxLength={10000} /></div>}
          {status === 'DONE' && <div className="space-y-2"><Label htmlFor="solution">Resumo da solução (compartilhado, obrigatório)</Label><Textarea id="solution" name="solution" required maxLength={10000} /></div>}
        </>}
        {operation === 'update' && <><div className="space-y-2"><Label htmlFor="edit-title">Título</Label><Input id="edit-title" name="title" defaultValue={baseline.title} required minLength={5} maxLength={150} /></div><div className="space-y-2"><Label htmlFor="edit-description">Descrição</Label><Textarea id="edit-description" name="description" defaultValue={baseline.description} required minLength={10} maxLength={10000} /></div><Choice id="priority" label="Prioridade" value={priority} onChange={value => setPriority(value as TicketPriority)} options={Object.entries(priorityLabels).map(([id, name]) => ({ id, name }))} /><div className="space-y-2"><Label htmlFor="dueDate">Vencimento (opcional, America/Sao_Paulo)</Label><Input id="dueDate" name="dueDate" type="date" defaultValue={baseline.dueDate ?? ''} /><p className="text-sm text-muted-foreground">Ao alterar, escolha hoje ou uma data futura. Deixe vazio para remover o prazo.</p></div></>}
        {operation === 'assign' && <fieldset className="space-y-3"><legend>Responsáveis ativos do setor</legend>{members.data?.items.map(person => <div key={person.id} className="flex items-center gap-3"><Checkbox id={'assignee-' + person.id} checked={assigned.includes(person.id)} onCheckedChange={checked => setAssigned(ids => checked === true ? [...new Set([...ids, person.id])] : ids.filter(id => id !== person.id))} /><Label className="min-h-10 flex-1 py-2" htmlFor={'assignee-' + person.id}>{person.name}</Label></div>)}<p>{assigned.length} selecionado(s), incluindo outras páginas.</p>{members.data && <Pages page={memberPage} total={members.data.total} busy={members.isFetching} onChange={setMemberPage} />}</fieldset>}
        {operation === 'transfer' && <DepartmentChoice userId={userId} scope="destinations" id="transfer-department" label="Novo setor (obrigatório)" value={departmentId} onChange={setDepartment} exclude={baseline.department.id} />}
        {needsReason && <div className="space-y-2"><Label htmlFor="reason">Motivo (interno, obrigatório)</Label><Textarea id="reason" name="reason" required maxLength={10000} /></div>}
        <Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar alteração'}</Button>
      </fieldset>
    </form>
  </Card>;
}
