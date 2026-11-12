'use client';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/confirm-button';
export function SessionBoundary({ id, theme, children }: { id: string; theme: string; children: React.ReactNode }) {
  const query = useQueryClient();
  const { setTheme } = useTheme();
  const initialized = useRef<string | null>(null);
  useEffect(() => {
    if (initialized.current === id) return;
    initialized.current = id;
    setTheme(theme);
  }, [id, theme, setTheme]);
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const response = await fetch('/api/me', { cache: 'no-store' });
        if (!active) return;
        if (response.status === 401 || (response.ok && (await response.json()).id !== id)) {
          query.clear(); window.location.replace('/login');
        }
      } catch { /* Network failures do not establish that the session was revoked. */ }
    };
    const timer = setInterval(() => { void check(); }, 30000);
    window.addEventListener('focus', check);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', check); };
  }, [id, query]);
  return children;
}
export function SessionControls() {
  const router = useRouter();
  const query = useQueryClient();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function logout(all: boolean) {
    setPending(true); setError('');
    try {
      const response = await fetch(all ? '/api/me' : '/api/auth/sign-out', { method: all ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!response.ok) throw new Error('Não foi possível encerrar. Tente novamente.');
      query.clear(); router.replace('/login'); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Falha de conexão.'); setPending(false); }
  }
  return <section className="mt-6 space-y-4" aria-labelledby="sessions-title"><h2 id="sessions-title">Acesso e sessões</h2>
    <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={pending} onClick={() => void logout(false)}>Sair</Button>
    <ConfirmButton label="Encerrar todas as sessões" description="Você precisará entrar novamente em todos os dispositivos." disabled={pending} onConfirm={() => logout(true)} /></div>
    <p role="alert">{error}</p>
  </section>;
}
