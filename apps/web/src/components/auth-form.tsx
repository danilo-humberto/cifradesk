'use client';
import Link from 'next/link';
import Image from 'next/image';
import localFont from 'next/font/local';
import { CircleCheck, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import logo from '@/assets/logo-cifra.png';
import { feedback } from '@/lib/feedback';
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
const authFont = localFont({ src: '../assets/fonts/manrope.ttf', display: 'swap', weight: '200 800' });
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const token = useRef('');
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token');
    // StrictMode repeats effects in development; keep the already captured token.
    if (value) token.current = value;
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
  }, []);
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
      if (mode === 'login') { feedback.clear(); router.replace('/'); router.refresh(); return; }
      setSuccess(true);
      setMessage(result.message ?? 'Senha salva. Você já pode entrar.');
      feedback.success(result.message ?? 'Senha salva. Você já pode entrar.');
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Falha de conexão. Tente novamente.';
      setMessage(text); feedback.error(text);
    }
    finally { setPending(false); }
  }
  return <main className={`auth-page ${authFont.className}`} id="main-content">
    <div className="auth-container">
    <Card className="auth-card">
      <CardHeader className="auth-header">
        <div className="auth-brand"><Image src={logo} alt="Logo Cifra" width={56} height={64} className="auth-logo" unoptimized priority /><CardTitle><h1 className="auth-heading">{copy[mode][0]}</h1></CardTitle></div>
        <CardDescription className="auth-description">{copy[mode][1]}</CardDescription>
      </CardHeader>
      <CardContent className="auth-content">
        {success ? <div className="auth-complete">
          <CircleCheck className="size-9 text-primary" aria-hidden="true" />
          <h2>{mode === 'accept-invitation' ? 'Conta ativada' : mode === 'forgot-password' ? 'Confira seu e-mail' : 'Senha atualizada'}</h2>
          <p>{message}</p>
          <Button asChild className="h-12 w-full"><Link href="/login">Entrar no CifraDesk</Link></Button>
          {mode === 'forgot-password' && <Button type="button" variant="ghost" className="w-full" onClick={() => { setSuccess(false); setMessage(''); }}>Tentar outro e-mail</Button>}
        </div> : <form method="post" onSubmit={submit} className="auth-fields" aria-label={copy[mode][0]} aria-busy={pending} aria-describedby={message ? 'auth-error' : undefined}>
          {(mode === 'login' || mode === 'forgot-password') && <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={254} /></div>}
          {mode !== 'forgot-password' && <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input id="password" name="password" type={passwordVisible ? 'text' : 'password'} className="pr-14" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} autoCapitalize="none" autoCorrect="off" spellCheck={false} minLength={8} maxLength={128} required />
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 size-12" aria-label="Mostrar senha" aria-pressed={passwordVisible} aria-controls="password" disabled={!mounted} onClick={() => setPasswordVisible(value => !value)}>
                {passwordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </Button>
            </div>
          </div>}
          {message && <p id="auth-error" className="feedback-inline-error">{message}</p>}
          <Button className="h-12 w-full" type="submit" disabled={!mounted || pending}>{pending && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}{pending ? 'Aguarde…' : copy[mode][2]}</Button>
        </form>}
        {!success && <div className="auth-links">
          {mode === 'login' ? <Link className="underline" href="/forgot-password">Esqueci minha senha</Link> : <Link className="underline" href="/login">Voltar para entrar</Link>}
          {mode === 'reset-password' && <Link className="underline" href="/forgot-password">Solicitar novo link</Link>}
        </div>}
        <noscript>Ative o JavaScript para enviar este formulário.</noscript>
      </CardContent>
    </Card>
    <p className="auth-caption">Chamados e tarefas da sua equipe, em um só lugar.</p>
    </div>
  </main>;
}
