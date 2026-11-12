import { randomUUID } from 'node:crypto';
import { test, expect, syntheticPassword } from './fixtures';
import { database } from '../../packages/database/src';
async function emailLink(email: string, kind: string) {
  let link = '';
  await expect.poll(async () => {
    const list = await (await fetch('http://identity-mailpit:8025/api/v1/search?query=' + encodeURIComponent('to:' + email))).json();
    for (const message of list.messages ?? []) {
      const detail = await (await fetch('http://identity-mailpit:8025/api/v1/message/' + message.ID)).json();
      const match = String(detail.Text).match(/http:\/\/[^\s]+/);
      if (match?.[0].includes(kind)) { link = match[0]; return true; }
    }
    return false;
  }).toBe(true);
  return link;
}
test('convite administrativo, login, recuperação e revogação pelo servidor', async ({ page, browser, request, baseURL }) => {
  const email = randomUUID() + '@example.test';
  await page.goto('/admin');
  await page.getByLabel('Nome', { exact: true }).first().fill('Nova pessoa');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Enviar convite', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Alteração salva.' })).toBeVisible();
  const link = await emailLink(email, 'accept-invitation');
  const context = await browser.newContext({ baseURL });
  const invited = await context.newPage();
  await invited.goto(link);
  await invited.getByLabel('Senha', { exact: true }).fill(syntheticPassword);
  await invited.getByRole('button', { name: 'Ativar minha conta' }).click();
  await expect(invited.getByRole('status')).toContainText('Senha salva');
  await invited.getByRole('link', { name: 'Voltar para entrar' }).click();
  await invited.getByLabel('E-mail').fill(email);
  await invited.getByLabel('Senha', { exact: true }).fill(syntheticPassword);
  await invited.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(invited.getByRole('heading', { name: 'Seu trabalho, em um só lugar.' })).toBeVisible();
  expect((await context.request.get('/api/admin/users')).status()).toBe(403);
  await invited.goto('/admin');
  await expect(invited).toHaveURL(baseURL! + '/');
  const user = await database().user.findUniqueOrThrow({ where: { email } });
  expect((await request.patch('/api/admin/users/' + user.id, { headers: { Origin: baseURL! }, data: { status: 'DISABLED' } })).status()).toBe(200);
  expect((await context.request.get('/api/me')).status()).toBe(401);
  await context.close();
});
test('recuperação por e-mail troca a senha, revoga sessões e permite encerrar todas', async ({ browser, request, baseURL, identity }) => {
  const email = identity.email;
  expect((await request.post('/api/auth/request-password-reset', { headers: { Origin: baseURL! }, data: { email } })).status()).toBe(200);
  const reset = await emailLink(email, 'reset-password');
  const resetting = await browser.newContext({ baseURL });
  const resetPage = await resetting.newPage();
  await resetPage.goto(reset);
  await resetPage.getByLabel('Senha', { exact: true }).fill('New-synthetic-e2e-123!');
  await resetPage.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(resetPage.getByRole('status')).toContainText('Senha salva');
  expect((await request.get('/api/me')).status()).toBe(401);
  expect((await resetting.request.post('/api/auth/sign-in/email', { headers: { Origin: baseURL! }, data: { email, password: 'New-synthetic-e2e-123!' } })).status()).toBe(200);
  expect((await resetting.request.delete('/api/me', { headers: { Origin: baseURL!, 'Content-Type': 'application/json' }, data: {} })).status()).toBe(200);
  expect((await resetting.request.get('/api/me')).status()).toBe(401);
  await resetting.close();
});
test('recusa cadastro público, origem externa e entrada excessiva', async ({ request, baseURL }) => {
  expect((await request.post('/api/auth/sign-up/email', { headers: { Origin: baseURL! }, data: {} })).status()).toBe(404);
  expect((await request.post('/api/admin/users', { headers: { Origin: 'https://untrusted.example' }, data: { name: 'Bad', email: 'bad@example.test' } })).status()).toBe(403);
  expect((await request.patch('/api/me', { headers: { Origin: baseURL! }, data: { theme: 'dark', isAdmin: true } })).status()).toBe(400);
  expect((await request.post('/api/admin/users', { headers: { Origin: baseURL! }, data: { name: 'x'.repeat(17000) } })).status()).toBe(413);
});
test('setores, integrantes e confirmação acessível', async ({ page, identity, request, baseURL }) => {
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Setores', exact: true }).click();
  const name = 'Setor ' + randomUUID().slice(0, 8);
  await page.getByLabel('Nome', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Criar setor' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Alteração salva' })).toBeVisible();
  const department = await database().department.findFirstOrThrow({ where: { name } });
  expect((await request.post('/api/admin/departments/' + department.id + '/members', { headers: { Origin: baseURL! }, data: { userId: identity.id } })).status()).toBe(200);
  const card = page.locator('[data-slot="card"]').filter({ has: page.locator('input[value="' + name + '"]') });
  await card.getByRole('button', { name: 'Integrantes', exact: true }).click();
  await expect(page.getByText(identity.email, { exact: false }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Remover vínculo' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await card.getByRole('button', { name: 'Desativar setor', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(card.getByText('Desativado', { exact: true })).toBeVisible();
});
test('sessão expirada redireciona ao login e aceita teclado', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('E-mail').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Senha', { exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('sair pela interface encerra o acesso', async ({ page, context }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await context.request.get('/api/me')).status()).toBe(401);
});
test('formulário de acesso sem JavaScript não envia senha por GET', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto('/login');
  await expect(page.getByRole('form')).toHaveAttribute('method', 'post');
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeDisabled();
  await context.close();
});
