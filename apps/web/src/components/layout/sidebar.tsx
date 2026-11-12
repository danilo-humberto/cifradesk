'use client';

import Link from 'next/link';
import Image from 'next/image';
import localFont from 'next/font/local';
import logo from '@/assets/logo-cifra.png';
import { usePathname } from 'next/navigation';
import { Bell, Building2, Inbox, ListTodo, Settings2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarGroup, SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar } from '@/components/ui/sidebar';

const brandFont = localFont({ src: '../../assets/fonts/manrope.ttf', display: 'swap', weight: '200 800' });

const links = [
  { href: '/', label: 'Meu trabalho', icon: ListTodo },
  { href: '/requests', label: 'Minhas solicitações', icon: Inbox },
  { href: '/departments', label: 'Setores', icon: Building2 },
  { href: '/notifications', label: 'Notificações', icon: Bell },
  { href: '/settings', label: 'Preferências', icon: Settings2 }
];

export function AppSidebar() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const closeMobile = () => { if (isMobile) setOpenMobile(false); };
  const menu = (items: typeof links) => <SidebarMenu>{items.map(({ href, label, icon: Icon }) => (
    <SidebarMenuItem key={href}>
      <SidebarMenuButton asChild tooltip={label} isActive={pathname === href} className="h-10 gap-3 [&>svg]:size-[18px]">
        <Link href={href} aria-label={label} onClick={closeMobile} aria-current={pathname === href ? 'page' : undefined}>
          <Icon aria-hidden="true" /><span className="group-data-[collapsible=icon]:hidden">{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  ))}</SidebarMenu>;

  return <Sidebar collapsible="icon">
    <nav aria-label="Navegação principal" className="flex h-full min-h-0 flex-col">
      <SidebarHeader className="gap-0 p-3 pb-5">
        <Link href="/" onClick={closeMobile} className="flex min-h-16 items-center gap-3 group-data-[collapsible=icon]:min-h-10" aria-label="CifraDesk, início">
          <Image src={logo} alt="Logo Cifra" className="h-16 w-14 max-w-none shrink-0 object-contain group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-8" unoptimized />
          <span className={`${brandFont.className} min-w-0 break-words text-[1.75rem] leading-tight font-semibold tracking-[0.06em] group-data-[collapsible=icon]:hidden`}>CifraDesk</span>
        </Link>
      </SidebarHeader>
      <SidebarContent><SidebarGroup className="px-3">{menu(links.slice(0, 3))}</SidebarGroup></SidebarContent>
      <SidebarFooter className="gap-3 p-3"><Separator />{menu(links.slice(3))}</SidebarFooter>
    </nav>
  </Sidebar>;
}
