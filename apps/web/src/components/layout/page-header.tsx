'use client';

import { usePathname } from 'next/navigation';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const titles: Record<string, string> = { '/': 'Meu trabalho', '/requests': 'Minhas solicitações', '/departments': 'Setores', '/notifications': 'Notificações', '/settings': 'Preferências' };

export function PageHeader() {
  const pathname = usePathname();
  return <header className="topbar">
    <div className="flex min-w-0 items-center gap-3">
      <SidebarTrigger /><Separator orientation="vertical" className="h-4!" />
      <Breadcrumb aria-label="Caminho da página"><BreadcrumbList>
        <BreadcrumbItem className="hidden sm:inline-flex">Espaço de trabalho</BreadcrumbItem>
        <BreadcrumbSeparator className="hidden sm:block" />
        <BreadcrumbItem><BreadcrumbPage>{titles[pathname] ?? 'Página não encontrada'}</BreadcrumbPage></BreadcrumbItem>
      </BreadcrumbList></Breadcrumb>
    </div>
    <Badge variant="outline" className="shrink-0 whitespace-nowrap text-muted-foreground">Prévia</Badge>
  </header>;
}
