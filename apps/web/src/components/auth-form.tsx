'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

type Mode = 'login' | 'accept-invitation' | 'forgot-password' | 'reset-password';
const copy = {
  login: ['Entre no CifraDesk', 'Use o e-mail cadastrado pela sua equipe.', 'Entrar'],
  'accept-invitation': ['Bem-vindo ao CifraDesk', 'Defina uma senha para ativar sua conta.', 'Ativar minha conta'],
  'forgot-password': ['Recuperar acesso', 'Enviaremos as instruções se sua conta estiver ativa.', 'Enviar instruções'],
  'reset-password': ['Redefinir senha', 'Escolha uma nova senha. As sessões anteriores serão encerradas.', 'Salvar nova senha']
};
const subscribe = () => () => {};
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const token = useRef('');
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token');
    // StrictMode repeats effects in development; keep the already captured token.
    if (value) token.current = value;
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
  }, []);
  useEffect(() => { if (message) messageRef.current?.focus(); }, [message]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setMessage(''); setSuccess(false);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const endpoint = mode === 'login' ? 'sign-in/email' : mode === 'forgot-password' ? 'request-password-reset' : mode;
    const payload = mode === 'login' ? { email, password } : mode === 'forgot-password' ? { email }
      : mode === 'accept-invitation' ? { token: token.current, password } : { token: token.current, newPassword: password };
    try {
      if ((mode === 'accept-invitation' || mode === 'reset-password') && !token.current)
        throw new Error('Link inválido ou expirado. Solicite um novo link.');
      const response = await fetch('/api/auth/' + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Não foi possível concluir.');
      if (mode === 'login') { router.replace('/'); router.refresh(); return; }
      setSuccess(true);
      setMessage(result.message ?? 'Senha salva. Você já pode entrar.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha de conexão. Tente novamente.'); }
    finally { setPending(false); }
  }
  return <main className="flex min-h-dvh items-center justify-center p-6" id="main-content">
    <Card className="w-full max-w-md">
      <CardHeader><p className="text-sm font-semibold text-primary">CifraDesk</p><CardTitle><h1>{copy[mode][0]}</h1></CardTitle><CardDescription>{copy[mode][1]}</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <form method="post" onSubmit={submit} className="space-y-5" aria-label={copy[mode][0]}>
          {(mode === 'login' || mode === 'forgot-password') && <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={254} /></div>}
          {mode !== 'forgot-password' && <div className="space-y-2"><Label htmlFor="password">Senha</Label><Input id="password" name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} maxLength={128} required aria-describedby="password-help" /><p id="password-help" className="text-sm text-muted-foreground">De 8 a 128 caracteres. Você pode colar sua senha.</p></div>}
          <Button className="w-full" type="submit" disabled={!mounted || pending || (success && mode !== 'forgot-password')}>{pending ? 'Aguarde…' : copy[mode][2]}</Button>
          <p ref={messageRef} tabIndex={-1} role={success ? 'status' : 'alert'} className="text-sm">{message}</p>
        </form>
        <div className="flex flex-wrap gap-4 text-sm">
          {mode === 'login' ? <Link className="underline" href="/forgot-password">Esqueci minha senha</Link> : <Link className="underline" href="/login">Voltar para entrar</Link>}
          {mode === 'reset-password' && <Link className="underline" href="/forgot-password">Solicitar novo link</Link>}
        </div>
        <noscript>Ative o JavaScript para enviar este formulário.</noscript>
      </CardContent>
    </Card>
  </main>;
}
