'use client';
import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PublicUser, PublicDepartment } from '@cifradesk/contracts/identity';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ConfirmButton } from '@/components/confirm-button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

type Result<T> = { items: T[]; total: number; page: number };
const subscribe = () => () => {};
async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await fetch('/api/admin/' + path, { method, headers: { 'Content-Type': 'application/json' }, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
  const result = await response.json();
  if (response.status === 401) { window.location.replace('/login'); throw new Error('Sessão encerrada.'); }
  if (!response.ok) throw new Error(result.error ?? 'Não foi possível concluir.');
  return result;
}
function Pages({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  return <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={page === 1} onClick={() => onChange(page - 1)}>Anterior</Button><span>Página {page} · {total} registros</span><Button variant="outline" disabled={page * 20 >= total} onClick={() => onChange(page + 1)}>Próxima</Button></div>;
}
function UserRow({ user, mutate, busy }: { user: PublicUser; mutate: (path: string, method: string, data?: unknown) => Promise<boolean>; busy: boolean }) {
  const [name, setName] = useState(user.name);
  const status = { ACTIVE: 'Ativo', INVITED: 'Convidado', DISABLED: 'Desativado' }[user.status];
  return <Card className="gap-4 p-5" aria-label={user.email}>
    <div className="flex flex-wrap items-center gap-2"><h3 className="break-all font-medium">{user.email}</h3><Badge variant="secondary">{status}</Badge>{user.isAdmin && <Badge>Administrador</Badge>}</div>
    <form method="post" className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); void mutate('users/' + user.id, 'PATCH', { name }); }}>
      <div className="min-w-0 flex-1 space-y-2"><Label htmlFor={'name-' + user.id}>Nome</Label><Input id={'name-' + user.id} value={name} onChange={e => setName(e.target.value)} required maxLength={120} /></div><Button type="submit" disabled={busy}>Salvar nome</Button>
    </form>
    <div className="flex flex-wrap gap-2">
      {!user.emailVerified ? <Button variant="outline" disabled={busy} onClick={() => void mutate('users/' + user.id + '/resend', 'POST', {})}>Reenviar convite</Button> :
        <ConfirmButton disabled={busy} label={user.status === 'ACTIVE' ? 'Desativar' : 'Reativar'} description="Desativar encerra o acesso e as sessões. Reativar exige uma conta que já definiu senha." onConfirm={() => { void mutate('users/' + user.id, 'PATCH', { status: user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' }); }} />}
      <ConfirmButton disabled={busy} label={user.isAdmin ? 'Remover administração' : 'Tornar administrador'} description="Administradores podem gerenciar usuários e setores. O último administrador ativo será preservado." onConfirm={() => { void mutate('users/' + user.id, 'PATCH', { isAdmin: !user.isAdmin }); }} />
      {user.status === 'INVITED' && <ConfirmButton disabled={busy} label="Desativar convite" description="Esta conta não poderá aceitar o convite." onConfirm={() => { void mutate('users/' + user.id, 'PATCH', { status: 'DISABLED' }); }} />}
    </div>
  </Card>;
}
function DepartmentRow({ department, mutate, busy, onMembers }: { department: PublicDepartment; mutate: (path: string, method: string, data?: unknown) => Promise<boolean>; busy: boolean; onMembers: () => void }) {
  const [name, setName] = useState(department.name);
  return <Card className="gap-4 p-5">
    <form method="post" className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void mutate('departments/' + department.id, 'PATCH', { name, active: department.active }); }}>
      <div className="min-w-0 flex-1 space-y-2"><Label htmlFor={department.id}>Nome do setor</Label><Input id={department.id} required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></div><Button disabled={busy}>Salvar setor</Button>
    </form>
    <div className="flex flex-wrap items-center gap-3"><Badge variant="secondary">{department.active ? 'Ativo' : 'Desativado'}</Badge><Button variant="outline" onClick={onMembers}>Integrantes</Button>
      <ConfirmButton disabled={busy} label={department.active ? 'Desativar setor' : 'Reativar setor'} description="Um setor desativado não concede acesso aos seus integrantes. Os vínculos são preservados." onConfirm={() => { void mutate('departments/' + department.id, 'PATCH', { name: department.name, active: !department.active }); }} />
    </div>
  </Card>;
}
function Members({ department, mutate, busy }: { department: PublicDepartment; mutate: (path: string, method: string, data?: unknown) => Promise<boolean>; busy: boolean }) {
  const [page, setPage] = useState(1);
  const [peoplePage, setPeoplePage] = useState(1);
  const [userId, setUserId] = useState('');
  const members = useQuery({ queryKey: ['admin', 'members', department.id, page], queryFn: () => api<Result<PublicUser>>('departments/' + department.id + '/members?page=' + page) });
  const people = useQuery({ queryKey: ['admin', 'users', peoplePage], queryFn: () => api<Result<PublicUser>>('users?page=' + peoplePage) });
  return <Card className="space-y-4 p-5"><h2 className="font-semibold">Integrantes de {department.name}</h2>
    <form method="post" className="space-y-3" onSubmit={e => { e.preventDefault(); if (userId) void mutate('departments/' + department.id + '/members', 'POST', { userId }); }}>
      <Label htmlFor="member-user">Pessoa ativa</Label><Select value={userId} onValueChange={setUserId}><SelectTrigger id="member-user" className="w-full"><SelectValue placeholder="Escolha uma pessoa" /></SelectTrigger>
        <SelectContent>{people.data?.items.filter(u => u.status === 'ACTIVE').map(u => <SelectItem key={u.id} value={u.id}>{u.name} · {u.email}</SelectItem>)}</SelectContent></Select>
      {people.data && <Pages page={peoplePage} total={people.data.total} onChange={p => { setPeoplePage(p); setUserId(''); }} />}
      <Button disabled={busy || !userId || !department.active}>Adicionar integrante</Button>
    </form>
    {(members.isPending || people.isPending) && <p role="status">Carregando pessoas…</p>}
    {(members.error || people.error) && <p role="alert">{(members.error || people.error)?.message}</p>}
    {members.data?.items.length === 0 && <p>Nenhum integrante neste setor.</p>}
    {members.data?.items.map(user => <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"><span className="break-all">{user.name} · {user.email}</span><ConfirmButton label="Remover vínculo" description={'Remover ' + user.name + ' deste setor?'} disabled={busy} onConfirm={() => { void mutate('departments/' + department.id + '/members/' + user.id, 'DELETE', {}); }} /></div>)}
    {members.data && <Pages page={page} total={members.data.total} onChange={setPage} />}
  </Card>;
}
export function AdminPanel() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [section, setSection] = useState<'users' | 'departments'>('users');
  const [page, setPage] = useState(1);
  const [department, setDepartment] = useState<PublicDepartment | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const query = useQueryClient();
  const users = useQuery({ queryKey: ['admin', 'users', page], queryFn: () => api<Result<PublicUser>>('users?page=' + page), enabled: section === 'users' });
  const departments = useQuery({ queryKey: ['admin', 'departments', page], queryFn: () => api<Result<PublicDepartment>>('departments?page=' + page), enabled: section === 'departments' });
  async function mutate(path: string, method: string, data?: unknown) {
    setBusy(true); setMessage(''); setFailed(false);
    try { await api(path, method, data); setMessage('Alteração salva.'); return true; }
    catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : 'Falha de conexão.'); return false; }
    finally { await query.invalidateQueries({ queryKey: ['admin'] }); setBusy(false); }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const payload = section === 'users' ? { name: String(data.get('name')), email: String(data.get('email')) } : { name: String(data.get('name')) };
    if (await mutate(section, 'POST', payload)) form.reset();
  }
  const current = section === 'users' ? users : departments;
  return <div className="max-w-4xl space-y-5">
    <div className="flex flex-wrap gap-2"><Button disabled={!mounted} variant={section === 'users' ? 'default' : 'outline'} onClick={() => { setSection('users'); setPage(1); setDepartment(null); }}>Usuários</Button><Button disabled={!mounted} variant={section === 'departments' ? 'default' : 'outline'} onClick={() => { setSection('departments'); setPage(1); }}>Setores</Button></div>
    <p role={failed ? 'alert' : 'status'}>{message}</p>
    <Card className="gap-4 p-5"><h2 className="font-semibold">{section === 'users' ? 'Convidar pessoa' : 'Novo setor'}</h2>
      <form method="post" key={section} onSubmit={create} className="space-y-3">
        <Label htmlFor="new-name">Nome</Label><Input id="new-name" name="name" required maxLength={120} autoComplete={section === 'users' ? 'name' : 'off'} />
        {section === 'users' && <><Label htmlFor="new-email">E-mail</Label><Input id="new-email" name="email" type="email" required maxLength={254} autoComplete="email" /></>}
        <Button disabled={busy || !mounted}>{section === 'users' ? 'Enviar convite' : 'Criar setor'}</Button>
      </form>
    </Card>
    {current.isPending && <p role="status">Carregando…</p>}
    {current.error && <p role="alert">{current.error.message}</p>}
    {current.data?.items.length === 0 && <p>Nenhum registro encontrado.</p>}
    {section === 'users' && users.data?.items.map(user => <UserRow key={user.id + user.name} user={user} mutate={mutate} busy={busy} />)}
    {section === 'departments' && departments.data?.items.map(item => <DepartmentRow key={item.id + item.name} department={item} mutate={mutate} busy={busy} onMembers={() => setDepartment(item)} />)}
    {current.data && <Pages page={page} total={current.data.total} onChange={setPage} />}
    {section === 'departments' && department && <Members key={department.id} department={departments.data?.items.find(d => d.id === department.id) ?? department} mutate={mutate} busy={busy} />}
  </div>;
}
