'use client';
import { PaginationFooter } from '@/components/pagination-footer';
import { useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PublicUser, PublicDepartment } from '@cifradesk/contracts/identity';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ConfirmButton } from '@/components/confirm-button';
import { feedback } from '@/lib/feedback';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { loadPeople, toggleVisible, addSelected } from '@/lib/member-selection';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { Building2, Search, UserPlus, Users, Plus } from 'lucide-react';
import { initials } from '@/lib/tickets';

import styles from './admin-panel.module.css';

const userStatus = { ACTIVE: 'Ativo', INVITED: 'Convidado', DISABLED: 'Desativado' };

type Result<T> = { items: T[]; total: number; page: number };
const subscribe = () => () => {};
async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await fetch('/api/admin/' + path, { method, headers: { 'Content-Type': 'application/json' }, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
  const result = await response.json();
  if (response.status === 401) { window.location.replace('/login'); throw new Error('Sessão encerrada.'); }
  if (!response.ok) throw new Error(result.error ?? 'Não foi possível concluir.');
  return result;
}
function UserRow({ user, mutate, busy }: { user: PublicUser; mutate: (path: string, method: string, data?: unknown) => Promise<boolean>; busy: boolean }) {
  const [name, setName] = useState(user.name);
  const status = { ACTIVE: 'Ativo', INVITED: 'Convidado', DISABLED: 'Desativado' }[user.status];
  return <Card className="min-w-0 gap-6 p-5 sm:p-6" aria-label={user.email}>
    <div className="flex flex-wrap items-center gap-3"><Avatar className="size-12"><AvatarFallback>{initials(user.name)}</AvatarFallback></Avatar><div className="min-w-0 flex-1 basis-[calc(100%-4rem)] sm:basis-0"><h2 className="break-words text-lg font-semibold">{user.name}</h2><p className="break-all text-sm text-muted-foreground">{user.email}</p></div><Badge variant="secondary" className={styles.statusBadge} data-status={user.status}>{status}</Badge><Badge variant="outline" className={user.isAdmin ? styles.adminBadge : undefined}>{user.isAdmin ? 'Administrador' : 'Membro'}</Badge></div>
    <form method="post" className="space-y-4" onSubmit={event => { event.preventDefault(); void mutate('users/' + user.id, 'PATCH', { name }); }}>
      <div className="space-y-2"><Label htmlFor={'name-' + user.id}>Nome</Label><Input id={'name-' + user.id} value={name} onChange={e => setName(e.target.value)} required maxLength={120} disabled={busy} /></div>
      <div className="space-y-2"><Label htmlFor={'email-' + user.id}>E-mail</Label><Input id={'email-' + user.id} value={user.email} readOnly className="text-muted-foreground" /></div>
      <Button type="submit" disabled={busy}>Salvar nome</Button>
    </form>
    <div className="space-y-3 border-t pt-5"><h3 className="text-sm font-medium">Acesso à conta</h3><p className="text-sm text-muted-foreground">Alterações de acesso exigem confirmação.</p><div className="flex flex-wrap gap-2">
      {!user.emailVerified ? <Button variant="outline" disabled={busy} onClick={() => void mutate('users/' + user.id + '/resend', 'POST', {})}>Reenviar convite</Button> :
        <ConfirmButton disabled={busy} label={user.status === 'ACTIVE' ? 'Desativar' : 'Reativar'} description="Desativar encerra o acesso e as sessões. Reativar exige uma conta que já definiu senha." onConfirm={() => { void mutate('users/' + user.id, 'PATCH', { status: user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' }); }} />}
      <ConfirmButton disabled={busy} label={user.isAdmin ? 'Remover administração' : 'Tornar administrador'} description="Administradores podem gerenciar usuários e setores. O último administrador ativo será preservado." onConfirm={() => { void mutate('users/' + user.id, 'PATCH', { isAdmin: !user.isAdmin }); }} />
      {user.status === 'INVITED' && <ConfirmButton disabled={busy} label="Desativar convite" description="Esta conta não poderá aceitar o convite." onConfirm={() => { void mutate('users/' + user.id, 'PATCH', { status: 'DISABLED' }); }} />}
    </div></div>
  </Card>;
}
function DepartmentRow({ department, mutate, busy, onMembers }: { department: PublicDepartment; mutate: (path: string, method: string, data?: unknown) => Promise<boolean>; busy: boolean; onMembers: () => void }) {
  const [name, setName] = useState(department.name);
  return <Card className="min-w-0 gap-6 p-5 sm:p-6">
    <div className="flex flex-wrap items-center gap-3"><div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted"><Building2 aria-hidden="true" className="size-6" /></div><div className="min-w-0 flex-1 basis-[calc(100%-4rem)] sm:basis-0"><h2 className="break-words text-lg font-semibold">{department.name}</h2><p className="text-sm text-muted-foreground">Dados e integrantes do setor</p></div><Badge variant="secondary" className={styles.statusBadge} data-status={department.active ? 'ACTIVE' : 'DISABLED'}>{department.active ? 'Ativo' : 'Desativado'}</Badge></div>
    <form id={'department-form-' + department.id} method="post" className="space-y-4" onSubmit={e => { e.preventDefault(); void mutate('departments/' + department.id, 'PATCH', { name, active: department.active }); }}>
      <div className="space-y-2"><Label htmlFor={department.id}>Nome do setor</Label><Input id={department.id} required maxLength={120} value={name} onChange={e => setName(e.target.value)} disabled={busy} /></div>
    </form>
    <div className="flex flex-wrap items-center gap-3"><Button type="submit" form={'department-form-' + department.id} disabled={busy}>Salvar setor</Button>
      <div className="ml-auto flex flex-wrap gap-2"><Button type="button" variant="outline" className="border-primary/25 bg-primary/15 text-foreground hover:bg-primary/25" disabled={busy} onClick={onMembers}><Users aria-hidden="true" />Integrantes</Button>
        <span className={styles.departmentStatusAction} data-active={department.active}><ConfirmButton disabled={busy} label={department.active ? 'Desativar setor' : 'Reativar setor'} description="Um setor desativado não concede acesso aos seus integrantes. Os vínculos são preservados." onConfirm={() => { void mutate('departments/' + department.id, 'PATCH', { name: department.name, active: !department.active }); }} /></span>
      </div>
    </div>
  </Card>;
}
function Members({ department, mutate, busy }: { department: PublicDepartment; mutate: (path: string, method: string, data?: unknown) => Promise<boolean>; busy: boolean }) {
  const [page, setPage] = useState(1);
  const members = useQuery({ queryKey: ['admin', 'members', department.id, page], queryFn: () => api<Result<PublicUser>>('departments/' + department.id + '/members?page=' + page) });
  return <Card className="space-y-4 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Integrantes de {department.name}</h2><MemberPicker department={department} busy={busy} /></div>
    {members.isPending && <p role="status">Carregando pessoas…</p>}
    {members.error && <p role="alert">{members.error.message}</p>}
    {members.data?.items.length === 0 && <p>Nenhum integrante neste setor.</p>}
    {members.data?.items.map(user => <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"><span className="break-all">{user.name} · {user.email}</span><ConfirmButton label="Remover vínculo" description={'Remover ' + user.name + ' deste setor?'} disabled={busy} onConfirm={() => { void mutate('departments/' + department.id + '/members/' + user.id, 'DELETE', {}); }} /></div>)}
    {members.data && <PaginationFooter label="Paginação dos integrantes" busy={members.isFetching} page={page} total={members.data.total} onChange={setPage} />}
  </Card>;
}

function MemberPicker({ department, busy }: { department: PublicDepartment; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const query = useQueryClient();
  const directory = useQuery({
    queryKey: ['admin', 'member-picker', department.id], enabled: open,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const [people, members] = await Promise.all([
        loadPeople(page => api<Result<PublicUser>>('users?page=' + page)),
        loadPeople(page => api<Result<PublicUser>>('departments/' + department.id + '/members?page=' + page))
      ]);
      return { people, memberIds: members.map(user => user.id) };
    }
  });
  const memberIds = new Set(directory.data?.memberIds);
  const term = search.trim().toLocaleLowerCase('pt-BR');
  const people = directory.data?.people ?? [];
  const visible = people.filter(user => (user.name + ' ' + user.email).toLocaleLowerCase('pt-BR').includes(term));
  const eligible = new Set(people.filter(user => user.status === 'ACTIVE' && !memberIds.has(user.id)).map(user => user.id));
  const visibleIds = visible.filter(user => eligible.has(user.id)).map(user => user.id);
  const selectedIds = selected.filter(id => eligible.has(id));
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
  const locked = busy || saving || directory.isFetching || !!directory.error;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || locked || !department.active || !selectedIds.length) return;
    savingRef.current = true; setSaving(true); setError('');
    try {
      const result = await addSelected(selectedIds, userId => api('departments/' + department.id + '/members', 'POST', { userId }));
      setSelected(result.remaining);
      if (result.error) setError(`${result.added.length} integrante(s) adicionado(s). ${result.error} As seleções restantes foram preservadas.`);
      if (result.added.length) feedback.success(`${result.added.length} integrante(s) adicionado(s).`);
      await query.invalidateQueries({ queryKey: ['admin'] });
      if (!result.error) setOpen(false);
    } finally { savingRef.current = false; setSaving(false); }
  }
  return <Sheet open={open} onOpenChange={value => { if (!savingRef.current) { setOpen(value); if (value) { setSearch(''); setSelected([]); setError(''); } } }}>
    <SheetTrigger asChild><Button type="button" disabled={busy || !department.active}><UserPlus aria-hidden="true" />Adicionar integrantes</Button></SheetTrigger>
    <SheetContent aria-labelledby="member-picker-title" className="w-full gap-0 sm:max-w-lg motion-reduce:animate-none" showCloseButton={!saving} onEscapeKeyDown={event => { if (savingRef.current) event.preventDefault(); }} onInteractOutside={event => { if (savingRef.current) event.preventDefault(); }}>
      <SheetHeader className="border-b p-6 pr-12"><SheetTitle id="member-picker-title">Adicionar integrantes</SheetTitle><SheetDescription>Selecione as pessoas para {department.name}. Contas inativas e integrantes atuais não podem ser selecionados.</SheetDescription></SheetHeader>
      <form method="post" aria-labelledby="member-picker-title" onSubmit={event => void submit(event)} className="flex min-h-0 flex-1 flex-col">
        <search className="space-y-2 px-6 pt-5"><Label htmlFor="member-search">Buscar usuários</Label><Input id="member-search" className="h-11" name="search" type="search" placeholder="Nome ou e-mail" autoComplete="off" autoCapitalize="none" spellCheck={false} value={search} disabled={saving} onChange={event => setSearch(event.target.value)} /></search>
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4"><span role="status" className="text-sm text-muted-foreground">{selectedIds.length} selecionado(s)</span><Button type="button" variant="outline" disabled={locked || !visibleIds.length} onClick={() => setSelected(current => toggleVisible(current, visibleIds))}>{allSelected ? 'Desmarcar todos' : 'Marcar todos'}</Button><p className="w-full text-xs text-muted-foreground">A seleção em grupo considera os resultados desta busca.</p></div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4" aria-busy={directory.isFetching}>
          {directory.isFetching ? <p role="status" className="flex items-center gap-2 py-6"><Spinner aria-hidden="true" />Carregando usuários…</p> : directory.error ? <div className="space-y-3"><p role="alert">{directory.error.message}</p><Button type="button" variant="outline" onClick={() => void directory.refetch()}>Tentar novamente</Button></div> : <fieldset disabled={saving || busy}><legend className="sr-only">Usuários disponíveis</legend><div className="space-y-2">{visible.map(user => {
            const member = memberIds.has(user.id);
            const disabled = !eligible.has(user.id);
            return <div key={user.id} className="flex min-h-16 items-center gap-3 rounded-lg border px-3 has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-primary/10">
              <Checkbox className={styles.memberCheckbox} id={'member-' + user.id} name="members" value={user.id} checked={member || selectedIds.includes(user.id)} disabled={disabled || saving || busy} onCheckedChange={checked => setSelected(current => checked === true ? [...new Set([...current, user.id])] : current.filter(id => id !== user.id))} />
              <Label htmlFor={'member-' + user.id} className="min-w-0 flex-1 flex-col items-start gap-1 py-3"><span className="break-words">{user.name}</span><span className="break-all text-xs font-normal text-muted-foreground">{user.email}</span><span className="text-xs text-muted-foreground">{member ? 'Já integra o setor' : userStatus[user.status]}</span></Label>
            </div>;
          })}{!visible.length && <p className="py-6 text-sm text-muted-foreground">Nenhum usuário encontrado.</p>}</div></fieldset>}
        </div>
        <div className="space-y-3 border-t bg-background p-6">{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={locked || !selectedIds.length || !department.active}>{saving && <Spinner aria-hidden="true" />}{saving ? 'Adicionando…' : `Adicionar selecionados (${selectedIds.length})`}</Button></div></div>
      </form>
    </SheetContent>
  </Sheet>;
}
export function AdminPanel() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [section, setSection] = useState<'users' | 'departments'>('users');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const query = useQueryClient();
  const users = useQuery({ queryKey: ['admin', 'users', page], queryFn: () => api<Result<PublicUser>>('users?page=' + page), enabled: section === 'users' });
  const departments = useQuery({ queryKey: ['admin', 'departments', page], queryFn: () => api<Result<PublicDepartment>>('departments?page=' + page), enabled: section === 'departments' });
  async function mutate(path: string, method: string, data?: unknown) {
    setBusy(true); setError('');
    try { await api(path, method, data); feedback.success('Alteração salva.'); return true; }
    catch (error) { const text = error instanceof Error ? error.message : 'Falha de conexão.'; setError(text); feedback.error(text); return false; }
    finally { await query.invalidateQueries({ queryKey: ['admin'] }); setBusy(false); }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    const payload = section === 'users' ? { name: String(data.get('name')), email: String(data.get('email')) } : { name: String(data.get('name')) };
    if (await mutate(section, 'POST', payload)) { form.reset(); setCreating(false); setSearch(''); }
  }
  const current = section === 'users' ? users : departments;
  const term = search.trim().toLocaleLowerCase('pt-BR');
  const visibleUsers = users.data?.items.filter(user => (user.name + ' ' + user.email).toLocaleLowerCase('pt-BR').includes(term)) ?? [];
  const visibleDepartments = departments.data?.items.filter(item => item.name.toLocaleLowerCase('pt-BR').includes(term)) ?? [];
  const selectedUser = visibleUsers.find(user => user.id === selectedId) ?? visibleUsers[0];
  const selectedDepartment = visibleDepartments.find(item => item.id === selectedId) ?? visibleDepartments[0];
  const hasItems = section === 'users' ? visibleUsers.length > 0 : visibleDepartments.length > 0;
  function changeSection(value: string) {
    if (value !== 'users' && value !== 'departments') return;
    setSection(value); setPage(1); setSelectedId(''); setSearch(''); setShowMembers(false); setError('');
  }
  return <Tabs value={section} onValueChange={changeSection} className="min-w-0 gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
      <TabsList variant="line" aria-label="Áreas da administração" className={styles.tabs} data-section={section}>
        <TabsTrigger value="users" disabled={!mounted || busy} className="cursor-pointer px-4"><Users aria-hidden="true" />Usuários</TabsTrigger>
        <TabsTrigger value="departments" disabled={!mounted || busy} className="cursor-pointer px-4"><Building2 aria-hidden="true" />Setores</TabsTrigger>
      </TabsList>
      <Dialog open={creating} onOpenChange={open => { if (!busy) { setCreating(open); setError(''); } }}>
        <DialogTrigger asChild><Button disabled={!mounted || busy}>{section === 'users' ? <UserPlus aria-hidden="true" /> : <Plus aria-hidden="true" />}{section === 'users' ? 'Convidar pessoa' : 'Novo setor'}</Button></DialogTrigger>
        <DialogContent className="max-h-[90dvh] overflow-y-auto" showCloseButton={!busy} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
          <DialogHeader><DialogTitle>{section === 'users' ? 'Convidar pessoa' : 'Novo setor'}</DialogTitle><DialogDescription>{section === 'users' ? 'Envie um convite por e-mail para entrar na equipe.' : 'Crie um setor para organizar os atendimentos e seus integrantes.'}</DialogDescription></DialogHeader>
          <form method="post" key={section} onSubmit={create} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="new-name">Nome</Label><Input id="new-name" name="name" required maxLength={120} disabled={busy} autoComplete={section === 'users' ? 'name' : 'off'} /></div>
            {section === 'users' && <div className="space-y-2"><Label htmlFor="new-email">E-mail</Label><Input id="new-email" name="email" type="email" required maxLength={254} disabled={busy} autoComplete="email" /></div>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setCreating(false)}>Cancelar</Button><Button disabled={busy || !mounted}>{busy && <Spinner aria-hidden="true" />}{section === 'users' ? 'Enviar convite' : 'Criar setor'}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    <TabsContent value={section} className="min-w-0 space-y-5">
      {error && !creating && <p role="alert" className="feedback-inline-error">{error}</p>}
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.6fr)]">
        <Card className="min-w-0 gap-4 p-3">
          <div className="space-y-2 px-1"><Label htmlFor="admin-search">Buscar nesta página</Label><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" /><Input id="admin-search" className="pl-9" placeholder={section === 'users' ? 'Nome ou e-mail' : 'Nome do setor'} value={search} disabled={busy} onChange={event => { setSearch(event.target.value); setSelectedId(''); setShowMembers(false); }} /></div></div>
          {current.isPending ? <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner aria-hidden="true" />Carregando…</div> : current.error ? <div className="space-y-3 p-3"><p role="alert" className="text-sm">{current.error.message}</p><Button variant="outline" onClick={() => void current.refetch()}>Tentar novamente</Button></div> : !hasItems ? <p className="p-4 text-sm text-muted-foreground">{term ? 'Nenhum resultado nesta página. Tente outro termo ou avance a página.' : 'Nenhum registro encontrado.'}</p> : <ul aria-label={section === 'users' ? 'Lista de usuários' : 'Lista de setores'} className="space-y-1">
            {section === 'users' ? visibleUsers.map(user => <li key={user.id}><Button type="button" variant="ghost" disabled={busy} aria-label={'Selecionar usuário ' + user.name} aria-pressed={selectedUser?.id === user.id} onClick={() => setSelectedId(user.id)} className="h-auto w-full min-w-0 justify-start gap-3 whitespace-normal border border-transparent px-3 py-3 text-left transition-colors duration-200 aria-pressed:border-primary/40 aria-pressed:bg-primary/10">
              <Avatar className="size-9 shrink-0"><AvatarFallback>{initials(user.name)}</AvatarFallback></Avatar><span className="min-w-0 flex-1"><span className="block truncate font-medium">{user.name}</span><span className="block truncate text-xs font-normal text-muted-foreground">{user.email}</span></span><Badge variant="secondary" className={styles.statusBadge} data-status={user.status}>{userStatus[user.status]}</Badge>
            </Button></li>) : visibleDepartments.map(item => <li key={item.id}><Button type="button" variant="ghost" disabled={busy} aria-label={'Selecionar setor ' + item.name} aria-pressed={selectedDepartment?.id === item.id} onClick={() => { setSelectedId(item.id); setShowMembers(false); }} className="h-auto w-full min-w-0 justify-start gap-3 whitespace-normal border border-transparent px-3 py-3 text-left transition-colors duration-200 aria-pressed:border-primary/40 aria-pressed:bg-primary/10"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><Building2 aria-hidden="true" /></span><span className="min-w-0 flex-1 truncate">{item.name}</span><Badge variant="secondary" className={styles.statusBadge} data-status={item.active ? 'ACTIVE' : 'DISABLED'}>{item.active ? 'Ativo' : 'Desativado'}</Badge></Button></li>)}
          </ul>}
        </Card>
        <div className="min-w-0 space-y-5" aria-busy={current.isFetching}>
          {current.isPending ? <Card className="min-h-80 items-center justify-center p-6"><Spinner className="size-8" aria-label="Carregando detalhes" /></Card> : current.error || !hasItems ? <Card className="min-h-80 items-center justify-center gap-3 p-6 text-center"><div className="rounded-xl bg-muted p-3">{section === 'users' ? <Users aria-hidden="true" /> : <Building2 aria-hidden="true" />}</div><h2 className="font-semibold">{current.error ? 'Não foi possível carregar os detalhes' : 'Nenhum item para exibir'}</h2><p className="max-w-sm text-sm text-muted-foreground">{term ? 'Ajuste a busca para selecionar um resultado.' : section === 'users' ? 'Convide uma pessoa para começar.' : 'Crie um setor para organizar a equipe.'}</p></Card> : section === 'users' && selectedUser ? <UserRow key={selectedUser.id + selectedUser.name} user={selectedUser} mutate={mutate} busy={busy} /> : selectedDepartment ? <>
            <DepartmentRow key={selectedDepartment.id + selectedDepartment.name} department={selectedDepartment} mutate={mutate} busy={busy} onMembers={() => setShowMembers(value => !value)} />
            {showMembers && <Members key={selectedDepartment.id} department={selectedDepartment} mutate={mutate} busy={busy} />}
          </> : null}
        </div>
      </div>
      {current.data && <PaginationFooter label={section === 'users' ? 'Paginação dos usuários' : 'Paginação dos setores'} busy={busy || current.isFetching} page={page} total={current.data.total} onChange={value => { setPage(value); setSelectedId(''); setShowMembers(false); }} />}
    </TabsContent>
  </Tabs>;
}
