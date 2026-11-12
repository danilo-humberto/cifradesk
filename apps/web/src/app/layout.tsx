import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
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
    <ThemeProvider>{children}</ThemeProvider>
  </body></html>;
}
