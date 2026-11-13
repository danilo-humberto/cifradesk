'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { initials, ticketApi, TicketApiError, type OptionPage } from '@/lib/tickets';

export function PersonAvatar({ person }: { person: { name: string; image: string | null } }) {
  return <Avatar role="img" aria-label={person.name} title={person.name}><AvatarImage src={person.image ?? undefined} alt="" /><AvatarFallback aria-hidden="true">{initials(person.name)}</AvatarFallback></Avatar>;
}
export function Pages({ page, total, size = 20, busy, onChange }: { page: number; total: number; size?: number; busy?: boolean; onChange: (page: number) => void }) {
  return <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" disabled={busy || page <= 1} onClick={() => onChange(page - 1)}>Anterior</Button><span>Página {page} · {total} registros</span><Button type="button" variant="outline" disabled={busy || page * size >= total} onClick={() => onChange(page + 1)}>Próxima</Button></div>;
}
export function QueryError({ error, reload }: { error: Error; reload: () => void }) {
  return <div className="space-y-3"><p role="alert">{error instanceof TicketApiError && [403, 404].includes(error.status) ? 'Conteúdo indisponível ou acesso não permitido.' : error.message}</p><Button type="button" variant="outline" onClick={reload}>Tentar novamente</Button></div>;
}
export function Choice({ id, label, value, onChange, options, disabled, required }: { id: string; label: string; value: string; onChange: (value: string) => void; options: { id: string; name: string }[]; disabled?: boolean; required?: boolean }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Select name={id} value={value} onValueChange={onChange} disabled={disabled} required={required}><SelectTrigger id={id} className="w-full"><SelectValue placeholder="Escolha uma opção" /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent></Select></div>;
}
export function DepartmentChoice({ userId, scope, id, label, value, onChange, exclude, disabled }: { userId: string; scope: 'destinations' | 'origins' | 'memberships'; id: string; label: string; value: string; onChange: (value: string) => void; exclude?: string; disabled?: boolean }) {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ['tickets', userId, 'options', scope, page], queryFn: ({ signal }) => ticketApi<OptionPage>(`/api/tickets/options?scope=${scope}&page=${page}`, { signal }) });
  return <div className="space-y-2"><Choice id={id} label={label} value={value} onChange={onChange} disabled={disabled || !query.data || !!query.error} required options={query.data?.items.filter(item => item.id !== exclude).map(item => ({ ...item, name: item.name + (item.active === false ? ' (desativado)' : '') })) ?? []} />
    {query.isPending && <p role="status">Carregando setores…</p>}{query.error && <QueryError error={query.error} reload={() => void query.refetch()} />}
    {query.data?.total === 0 && <p>Nenhum setor disponível.</p>}{query.data && query.data.total > 20 && <Pages page={page} total={query.data.total} busy={query.isFetching} onChange={p => { setPage(p); onChange(''); }} />}
  </div>;
}
