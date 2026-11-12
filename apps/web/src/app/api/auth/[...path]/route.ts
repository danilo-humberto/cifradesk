import { acceptInput, emailInput, passwordInput } from '@cifradesk/contracts/identity';
import { auth, acceptInvitation, limitAttempts, resetIdentityPassword, signInRequest } from '@/lib/server/identity';
import { body, failure, json, sameOrigin } from '@/lib/server/http';
import { z } from 'zod';
const loginInput = z.object({ email: emailInput, password: passwordInput }).strict();
const resetInput = z.object({ token: z.string().min(1).max(256), newPassword: passwordInput }).strict();
export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    sameOrigin(request);
    const path = (await context.params).path.join('/');
    if (!['sign-in/email', 'sign-out', 'request-password-reset', 'reset-password', 'accept-invitation'].includes(path)) return json({ error: 'Não encontrado.' }, 404);
    const data = await body(request);
    await limitAttempts('auth-global', 120);
    if (path === 'accept-invitation') {
      const input = acceptInput.parse(data);
      await limitAttempts('invite:' + input.token, 10);
      await acceptInvitation(input.token, input.password);
      return json({ ok: true });
    }
    if (path === 'request-password-reset') {
      const { email } = z.object({ email: emailInput }).strict().parse(data);
      await limitAttempts('reset:' + email, 5);
      try { await auth().api.requestPasswordReset({ body: { email } }); }
      catch { console.error('identity.reset_delivery_failed'); }
      return json({ message: 'Se a conta estiver ativa, enviaremos as instruções por e-mail.' });
    }
    if (path === 'reset-password') {
      const input = resetInput.parse(data);
      await limitAttempts('reset-token:' + input.token, 10);
      await resetIdentityPassword(input.token, input.newPassword);
      return json({ ok: true });
    }
    const payload = path === 'sign-in/email' ? loginInput.parse(data) : {};
    if ('email' in payload) await limitAttempts('login:' + payload.email, 10);
    const forwarded = new Request(new URL('/api/auth/' + path, process.env.BETTER_AUTH_URL), {
      method: 'POST', headers: request.headers, body: JSON.stringify(payload)
    });
    const response = await (path === 'sign-in/email' ? signInRequest(forwarded) : auth().handler(forwarded));
    if (!response.ok) return json({ error: path === 'sign-in/email' ? 'E-mail ou senha inválidos, ou acesso indisponível.' : 'Não foi possível sair.' }, response.status);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) { return failure(error); }
}
