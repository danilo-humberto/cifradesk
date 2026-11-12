import { AppSidebar } from '@/components/layout/sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { PageHeader } from '@/components/layout/page-header';
import { QueryProvider } from '@/lib/query/provider';
import { SessionBoundary } from '@/components/session-controls';
import { requireUser } from '@/lib/server/session';
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <QueryProvider key={user.id}><SessionBoundary id={user.id} theme={user.theme}>
    <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
    <SidebarProvider style={{ '--sidebar-width': '320px', '--sidebar-width-icon': '56px' } as React.CSSProperties}>
      <AppSidebar isAdmin={user.isAdmin} /><div className="main-shell"><PageHeader /><main id="main-content" tabIndex={-1}>{children}</main></div>
    </SidebarProvider>
  </SessionBoundary></QueryProvider>;
}
