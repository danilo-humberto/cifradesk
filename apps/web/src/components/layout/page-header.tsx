'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Fragment } from 'react';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const titles: Record<string, string> = { '/': 'Meu trabalho', '/requests': 'Minhas solicitações', '/departments': 'Setores', '/notifications': 'Notificações', '/settings': 'Preferências', '/admin': 'Administração' };

export function PageHeader() {
  const pathname = usePathname();
  const ancestors = pathname.startsWith('/requests/') ? [{ href: '/requests', title: titles['/requests'] }] : [];
  const title = titles[pathname] ?? (pathname === '/requests/new' ? 'Abrir chamado' : pathname.startsWith('/requests/') ? 'Detalhe do chamado' : 'Página não encontrada');
  return <header className="topbar">
    <div className="flex min-w-0 items-center gap-3">
      <SidebarTrigger /><Separator orientation="vertical" className="h-4!" />
      <Breadcrumb aria-label="Caminho da página"><BreadcrumbList>
        <BreadcrumbItem><BreadcrumbLink asChild className="cursor-pointer"><Link href="/">Espaço de trabalho</Link></BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        {ancestors.map(item => <Fragment key={item.href}><BreadcrumbItem><BreadcrumbLink asChild className="cursor-pointer"><Link href={item.href}>{item.title}</Link></BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /></Fragment>)}
        <BreadcrumbItem><BreadcrumbPage>{title}</BreadcrumbPage></BreadcrumbItem>
      </BreadcrumbList></Breadcrumb>
    </div>
    <Badge variant="outline" className="shrink-0 whitespace-nowrap text-muted-foreground">Prévia</Badge>
  </header>;
}
