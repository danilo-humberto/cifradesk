import { test, expect } from '@playwright/test';

// Public-page tests intercept every submission; no real invitation or account is used.
test('ativação apresenta marca, sucesso persistente e toast dispensável por teclado', async ({ page }, testInfo) => {
  await page.route('**/api/auth/accept-invitation', route => route.fulfill({ status: 200, json: { message: 'Senha salva. Você já pode entrar.' } }));
  await page.goto('/accept-invitation#token=synthetic-interface-token');
  await expect(page.getByRole('img', { name: 'Logo Cifra' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bem-vindo ao CifraDesk' })).toBeVisible();
  await page.getByLabel('Senha', { exact: true }).fill('Synthetic-ui-123!');
  await page.getByRole('button', { name: 'Ativar minha conta' }).click();
  const notification = page.getByRole('region', { name: /Notificações/ });
  await expect(notification).toContainText('Senha salva. Você já pode entrar.');
  await expect(page.getByRole('heading', { name: 'Conta ativada' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Entrar no CifraDesk', exact: true })).toBeVisible();
  await page.screenshot({ path: `.local/auth-toast-${testInfo.project.name}.png`, fullPage: true, animations: 'disabled' });
  const close = notification.getByRole('button', { name: 'Fechar notificação' });
  await page.keyboard.press('Alt+t');
  await expect(notification.getByRole('list')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(notification.getByRole('listitem')).toBeFocused();
  await expect(notification.getByRole('listitem')).toHaveCSS('outline-style', 'solid');
  await expect(notification.getByRole('listitem')).toHaveCSS('outline-width', '3px');
  await page.screenshot({ path: `.local/auth-toast-focus-${testInfo.project.name}.png`, fullPage: true, animations: 'disabled' });
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(notification.getByText('Senha salva. Você já pode entrar.')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Conta ativada' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `.local/auth-success-${testInfo.project.name}.png`, fullPage: true });
});

test('falha no formulário mantém os campos, oferece toast e permite nova tentativa', async ({ page }, testInfo) => {
  await page.clock.install();
  await page.route('**/api/auth/accept-invitation', route => route.fulfill({ status: 400, json: { error: 'Link inválido ou expirado. Solicite um novo link.' } }));
  await page.goto('/accept-invitation#token=synthetic-invalid-token');
  const password = page.getByLabel('Senha', { exact: true });
  await password.fill('Synthetic-ui-123!');
  await page.getByRole('button', { name: 'Ativar minha conta' }).click();
  const notification = page.getByRole('region', { name: /Notificações/ });
  await expect(notification).toContainText('Link inválido ou expirado. Solicite um novo link.');
  await page.clock.fastForward(7000);
  await expect(notification.getByText('Link inválido ou expirado. Solicite um novo link.')).toBeVisible();
  await notification.getByRole('button', { name: 'Fechar notificação' }).click();
  await expect(page.getByRole('form')).toContainText('Link inválido ou expirado. Solicite um novo link.');
  await expect(password).toHaveValue('Synthetic-ui-123!');
  await expect(page.getByRole('button', { name: 'Ativar minha conta' })).toBeEnabled();
  await page.screenshot({ path: `.local/auth-error-${testInfo.project.name}.png`, fullPage: true });
});

test('formulário tem logo, tema e layout sem overflow em tela estreita', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/accept-invitation');
  await expect(page.getByRole('img', { name: 'Logo Cifra' })).toBeVisible();
  await page.getByLabel('Senha', { exact: true }).focus();
  await page.keyboard.press('Tab');
  const visibility = page.getByRole('button', { name: 'Mostrar senha', exact: true });
  await expect(visibility).toBeFocused();
  const password = page.getByLabel('Senha', { exact: true });
  await password.fill('Synthetic-visibility-123!');
  let submissions = 0;
  await page.route('**/api/auth/**', route => { submissions++; return route.abort(); });
  await visibility.click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(visibility).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Space');
  await expect(password).toHaveAttribute('type', 'password');
  await expect(password).toHaveValue('Synthetic-visibility-123!');
  await expect(visibility).toHaveAttribute('aria-pressed', 'false');
  expect(submissions).toBe(0);
  await expect(page.locator('#password-help')).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Ativar minha conta' })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `.local/auth-opening-${testInfo.project.name}.png`, fullPage: true });
});
