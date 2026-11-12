import type { Metadata, Viewport } from 'next';
import { AppSidebar } from '@/components/layout/sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { PageHeader } from '@/components/layout/page-header';
import { ThemeProvider } from '@/components/theme-provider';
import { QueryProvider } from '@/lib/query/provider';
import './globals.css';

export const metadata: Metadata = { title: { default: 'CifraDesk', template: '%s | CifraDesk' }, description: 'Chamados e tarefas da equipe em um só lugar.', robots: { index: false, follow: false } };
export const viewport: Viewport = { colorScheme: 'light dark', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" suppressHydrationWarning><body>
    <noscript><style>{`
      [data-slot="sidebar-trigger"] { display: none; }
      @media (max-width: 767px) {
        [data-slot="sidebar-wrapper"] { flex-direction: column; }
        [data-slot="sidebar"] { display: block; }
        [data-slot="sidebar-gap"] { display: none; }
        [data-slot="sidebar-container"] { display: flex; position: static; width: 100%; height: auto; }
      }
    `}</style></noscript>
    <ThemeProvider><QueryProvider>
      <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
      <SidebarProvider style={{ '--sidebar-width': '320px', '--sidebar-width-icon': '56px' } as React.CSSProperties}><AppSidebar /><div className="main-shell">
        <PageHeader />
        <main id="main-content" tabIndex={-1}>{children}</main>
      </div></SidebarProvider>
    </QueryProvider></ThemeProvider>
  </body></html>;
}
