import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';

async function navigate(page: Page, name: string) {
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    await page.getByRole('button', { name: 'Alternar navegação' }).click();
  }
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function chooseTheme(page: Page, label: string | RegExp) {
  await page.getByRole('combobox', { name: 'Tema da interface' }).click();
  await page.getByRole('option', { name: label, exact: typeof label === 'string' }).click();
}

test('navegação, preferências persistidas e ausência de erros no navegador', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Seu trabalho, em um só lugar.' })).toBeVisible();
  await navigate(page, 'Preferências');
  await expect(page.getByRole('heading', { name: 'Preferências', exact: true })).toBeVisible();
  await chooseTheme(page, 'Escuro');
  await expect(page.locator('html')).toHaveClass('dark');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Tema da interface' })).toHaveText('Escuro');
  await chooseTheme(page, 'Claro');
  await expect(page.locator('html')).toHaveClass('light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await chooseTheme(page, /^Automático/);
  await expect(page.locator('html')).toHaveClass('dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveClass('light');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await navigate(page, 'Minhas solicitações');
  await expect(page.getByRole('heading', { name: 'Minhas solicitações', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('select de tema usa lista acessível e teclado', async ({ page }) => {
  await page.goto('/settings');
  const theme = page.getByRole('combobox', { name: 'Tema da interface' });
  await expect(theme).toBeEnabled();
  await theme.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(theme).toHaveText('Escuro');
  await expect(page.locator('html')).toHaveClass('dark');
  await expect(theme).toBeFocused();
  await page.keyboard.press('Space');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(theme).toBeFocused();
});

test('sidebar abre, fecha e identifica a página ativa', async ({ page }) => {
  await page.goto('/settings');
  const trigger = page.getByRole('button', { name: 'Alternar navegação' });
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    await trigger.click();
    await expect(page.getByRole('dialog', { name: 'Navegação' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Logo Cifra' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Preferências', exact: true })).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.getByRole('button', { name: 'Fechar navegação' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } else {
    await expect(page.locator('[data-slot=sidebar-container]')).toHaveCSS('width', '320px');
    await expect(page.getByText('Equipe Cifra', { exact: true })).toHaveCount(0);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('[data-slot=sidebar-container]')).toHaveCSS('width', '56px');
    const logo = page.getByRole('img', { name: 'Logo Cifra' });
    await expect(logo).toBeVisible();
    await expect(logo).toHaveCSS('width', '32px');
    await expect.poll(() => logo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Preferências', exact: true })).toBeVisible();
    await trigger.click();
    await expect(page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Preferências', exact: true })).toHaveAttribute('aria-current', 'page');
  }
});

test('atalho de teclado leva ao conteúdo', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});

test('sem JavaScript respeita o tema do sistema e mantém a navegação', async ({ browser, baseURL, page: authenticatedPage }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: 'dark', viewport: testInfo.project.use.viewport, storageState: await authenticatedPage.context().storageState() });
  const page = await context.newPage();
  await page.goto(baseURL!);
  await expect(page.getByRole('heading', { name: 'Seu trabalho, em um só lugar.' })).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(24, 24, 27)');
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Preferências' }).click();
  await expect(page.getByRole('heading', { name: 'Preferências', exact: true })).toBeVisible();
  await context.close();
});

test('healthcheck público não retorna configuração interna', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok', service: 'web' });
  const icon = await request.get('/icon.png');
  expect(icon.status()).toBe(200);
  expect(icon.headers()['content-type']).toContain('image/png');
});

test('tema revela a tela radialmente a partir do seletor', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await page.goto('/settings');
  const trigger = page.getByRole('combobox', { name: 'Tema da interface' });
  const rect = await trigger.boundingBox();
  await trigger.click();
  const animation = page.waitForFunction(() => {
    const effect = document.getAnimations().map(animation => animation.effect).find(effect =>
      effect instanceof KeyframeEffect && effect.pseudoElement === '::view-transition-new(root)'
    ) as KeyframeEffect | undefined;
    return effect?.getKeyframes().map(frame => frame.clipPath);
  });
  await page.getByRole('option', { name: 'Escuro', exact: true }).click();
  const frames = await (await animation).jsonValue();
  const start = String(frames?.[0]).match(/circle\(([\d.]+)px at ([\d.]+)px ([\d.]+)px\)/);
  expect(start).not.toBeNull();
  expect(Number(start![1])).toBe(0);
  expect(Number(start![2])).toBeCloseTo(rect!.x + rect!.width / 2, 2);
  expect(Number(start![3])).toBeCloseTo(rect!.y + rect!.height / 2, 2);
  const endRadius = Number(String(frames?.[1]).match(/circle\(([\d.]+)px/)?.[1]);
  const viewport = page.viewportSize()!;
  expect(endRadius).toBeGreaterThanOrEqual(Math.hypot(Math.max(Number(start![2]), viewport.width - Number(start![2])), Math.max(Number(start![3]), viewport.height - Number(start![3]))) - 0.01);
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(24, 24, 27)');
  await expect(trigger).toBeFocused();
});

for (const fallback of ['reduced-motion', 'unsupported'] as const) {
  test(`tema continua funcionando com ${fallback}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: fallback === 'reduced-motion' ? 'reduce' : 'no-preference' });
    if (fallback === 'unsupported') await page.addInitScript(() => {
      Object.defineProperty(document, 'startViewTransition', { value: undefined });
    });
    await page.goto('/settings');
    await chooseTheme(page, 'Escuro');
    await expect(page.locator('html')).toHaveClass('dark');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition');
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Tema da interface' })).toHaveText('Escuro');
  });
}

test('última escolha de tema prevalece durante uma transição', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await page.goto('/settings');
  await page.getByRole('combobox', { name: 'Tema da interface' }).click();
  const paused = page.waitForFunction(() => {
    const animation = document.getAnimations().find(item => item.effect instanceof KeyframeEffect && item.effect.pseudoElement === '::view-transition-new(root)');
    if (!animation) return false;
    animation.pause();
    return true;
  });
  await page.getByRole('option', { name: 'Escuro', exact: true }).click();
  await paused;
  await page.keyboard.press('Space');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Home');
  await expect(page.getByRole('option', { name: /^Automático/ })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: 'Claro', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await page.evaluate(() => document.getAnimations().forEach(animation => animation.play()));
  await expect(page.locator('html')).toHaveClass('light');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-transition');
  await expect(page.getByRole('combobox', { name: 'Tema da interface' })).toHaveText('Claro');
});
