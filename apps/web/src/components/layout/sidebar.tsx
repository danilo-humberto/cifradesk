'use client';

import Link from 'next/link';
import Image from 'next/image';
import localFont from 'next/font/local';
import { useRef, useState, type CSSProperties } from 'react';
import logo from '@/assets/logo-cifra.png';
import { usePathname } from 'next/navigation';
import { Bell, Building2, ChevronUp, Inbox, ListTodo, LogOut, Plus, Settings2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useLogout } from '@/components/session-controls';
import { initials } from '@/lib/tickets';
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

export function AppSidebar({ isAdmin = false, user }: { isAdmin?: boolean; user: { name: string; email: string; image: string | null } }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const { logout, pending, error } = useLogout();
  const [accountOpen, setAccountOpen] = useState(false);
  const navigating = useRef(false);
  const closeMobile = () => { if (isMobile) setOpenMobile(false); };
  const items = [...links.slice(0, 3), ...(isAdmin ? [{ href: '/admin', label: 'Administração', icon: Settings2 }] : [])];
  const activeIndex = items.findIndex(({ href }) => href === '/' ? pathname === href : pathname === href || pathname.startsWith(href + '/'));
  const menu = <SidebarMenu className="sidebar-sliding-menu" data-has-active={activeIndex >= 0} style={{ '--active-index': Math.max(activeIndex, 0) } as CSSProperties}>{items.map(({ href, label, icon: Icon }, index) => (
    <SidebarMenuItem key={href}>
      <SidebarMenuButton asChild tooltip={label} isActive={activeIndex === index} className="sidebar-navigation-link h-10 gap-3 group-data-[collapsible=icon]:h-10! group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:px-[7px]! [&>svg]:size-[18px]">
        <Link href={href} aria-label={label} onClick={closeMobile} aria-current={activeIndex === index ? 'page' : undefined}>
          <Icon aria-hidden="true" /><span className="sidebar-label">{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  ))}</SidebarMenu>;
  function navigateAccount() {
    navigating.current = true;
    setAccountOpen(false);
    closeMobile();
  }

  return <Sidebar collapsible="icon" resizable>
    <nav aria-label="Navegação principal" className="flex h-full min-h-0 flex-col">
      <SidebarHeader className="gap-0 p-3 pb-5">
        <Link href="/" onClick={closeMobile} className="sidebar-brand flex h-16 items-center gap-3" aria-label="CifraDesk, início">
          <Image src={logo} alt="Logo Cifra" className="sidebar-logo h-16 w-14 max-w-none shrink-0 object-contain" unoptimized />
          <span className={`${brandFont.className} sidebar-label min-w-0 overflow-hidden whitespace-nowrap text-[1.75rem] leading-tight font-semibold tracking-[0.06em]`}>CifraDesk</span>
        </Link>
      </SidebarHeader>
      <SidebarContent><SidebarGroup className="px-3">{menu}</SidebarGroup></SidebarContent>
      <SidebarFooter className="gap-3 p-3">
        <SidebarMenu><SidebarMenuItem>
          <SidebarMenuButton asChild tooltip="Abrir chamado" className="h-10 cursor-pointer justify-center gap-3 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground group-data-[collapsible=icon]:h-10! group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:px-[7px]!">
            <Link href="/requests/new" aria-label="Abrir chamado" onClick={closeMobile}><Plus aria-hidden="true" /><span className="sidebar-label">Abrir chamado</span></Link>
          </SidebarMenuButton>
        </SidebarMenuItem></SidebarMenu>
        <Separator />
        <SidebarMenu><SidebarMenuItem>
          <DropdownMenu open={accountOpen} onOpenChange={open => { setAccountOpen(open); if (open) navigating.current = false; }}>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" tooltip="Menu da conta" aria-label={`Menu da conta: ${user.email}`} aria-describedby={accountOpen && error ? 'account-menu-error' : undefined} className="account-menu-trigger gap-3 rounded-lg group-data-[collapsible=icon]:h-12! group-data-[collapsible=icon]:w-full!">
                <Avatar className="size-8 shrink-0"><AvatarImage src={user.image ?? undefined} alt="" /><AvatarFallback>{initials(user.name)}</AvatarFallback></Avatar>
                <span className="sidebar-label min-w-0 flex-1 text-left"><span className="block truncate font-medium">{user.name}</span><span className="block truncate text-xs text-muted-foreground">{user.email}</span></span>
                <ChevronUp aria-hidden="true" className="sidebar-label ml-auto size-4 shrink-0" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" sideOffset={8} collisionPadding={12} className="w-64 max-w-[calc(100vw-1.5rem)] rounded-xl p-2 motion-reduce:animate-none" onCloseAutoFocus={event => { if (navigating.current) event.preventDefault(); }}>
              <DropdownMenuLabel className="min-w-0 px-2 py-2"><span className="block truncate font-medium">{user.name}</span><span className="block break-all text-xs font-normal text-muted-foreground">{user.email}</span></DropdownMenuLabel>
              <DropdownMenuSeparator />
              {links.slice(3).map(({ href, label, icon: Icon }) => <DropdownMenuItem asChild key={href} className="min-h-10 rounded-md transition-colors duration-200"><Link href={href} onClick={navigateAccount} aria-current={pathname === href ? 'page' : undefined}><Icon aria-hidden="true" />{label}</Link></DropdownMenuItem>)}
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={pending} className="min-h-10 rounded-md text-destructive transition-colors duration-200 focus:text-destructive dark:text-red-400 dark:focus:text-red-400 [&_svg]:text-current!" onSelect={event => { event.preventDefault(); void logout(false); }}><LogOut aria-hidden="true" />{pending ? 'Saindo…' : 'Sair da conta'}</DropdownMenuItem>
              {error && <p id="account-menu-error" className="px-2 py-2 text-sm text-destructive">{error}</p>}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem></SidebarMenu>
        <noscript><div className="flex flex-col gap-2 text-sm">{links.slice(3).map(({ href, label }) => <Link href={href} key={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}<p>Ative o JavaScript para sair da conta.</p></div></noscript>
      </SidebarFooter>
    </nav>
  </Sidebar>;
}
