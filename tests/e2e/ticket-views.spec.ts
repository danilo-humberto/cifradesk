import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import { database } from '../../packages/database/src';
import { createTicket } from '../../packages/infrastructure/src/tickets';

test('visualizações preservam dados, filtros, página e atualização', async ({ page, identity }, testInfo) => {
  test.setTimeout(90000);
  const db = database();
  const sector = await db.department.create({ data: { name: `Visualizações ${randomUUID()}`, memberships: { create: { userId: identity.id } } } });
  const actor = await db.user.findUniqueOrThrow({ where: { id: identity.id } });
  for (let index = 0; index < 21; index++) {
    await createTicket(actor, { title: `Chamado visual ${index}`, description: 'Dados sintéticos para alternância de apresentação', requestedFor: 'SELF', originDepartmentId: sector.id, departmentId: sector.id });
  }
  for (const path of ['/requests', '/departments']) {
    await page.goto(path);
    const view = page.getByRole('combobox', { name: 'Visualização dos chamados' });
    await expect(view).toContainText('Tabela');
    await expect(page.getByRole('button', { name: 'Atualizar lista', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Atualizar lista', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(view).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Abrir chamado', exact: true })).toBeFocused();
    await page.getByRole('combobox', { name: 'Filtrar por status' }).click();
    await page.getByRole('option', { name: 'ABERTA', exact: true }).click();
    await page.getByRole('combobox', { name: 'Filtrar por setor' }).click();
    await page.getByRole('option', { name: sector.name, exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    const next = page.getByRole('button', { name: 'Próxima', exact: true });
    await next.scrollIntoViewIfNeeded();
    await expect(next).toBeInViewport();
    if (testInfo.project.name === 'mobile') await next.tap();
    else await next.click();
    await expect(page.getByRole('navigation', { name: 'Paginação dos chamados' })).toHaveText(/21 registros\s*Página 2/);
    const link = page.getByRole('link', { name: /CH-.*Chamado visual/ });
    const href = await link.getAttribute('href');
    const listRequests: string[] = [];
    page.on('request', request => { if (/\/api\/tickets\/(mine|queue)\?/.test(request.url())) listRequests.push(request.url()); });
    for (const mode of ['Lista', 'Cards', 'Tabela']) {
      await view.focus();
      await page.keyboard.press('Space');
      await page.getByRole('option', { name: mode, exact: true }).click();
      await expect(view).toBeFocused();
      await expect(link).toHaveAttribute('href', href!);
      await expect(page.getByRole('navigation', { name: 'Paginação dos chamados' })).toHaveText(/21 registros\s*Página 2/);
      await expect(page.getByRole('combobox', { name: 'Filtrar por status' })).toContainText('ABERTA');
      await expect(page.getByRole('combobox', { name: 'Filtrar por setor' })).toContainText(sector.name);
      await expect(page.getByText('Sem responsável', { exact: true })).toBeVisible();
      await expect(page.getByRole('img', { name: 'E2E Admin' })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
      await page.screenshot({ path: `.local/ticket-view-${path.slice(1)}-${mode}-${testInfo.project.name}.png`, fullPage: true });
    }
    expect(listRequests).toHaveLength(0);
    const response = page.waitForResponse(response => response.url().includes(`/api/tickets/${path === '/requests' ? 'mine' : 'queue'}?`) && response.status() === 200);
    await page.getByRole('button', { name: 'Atualizar lista', exact: true }).click();
    await response;
    await expect(link).toHaveAttribute('href', href!);
    await expect(page.getByRole('navigation', { name: 'Paginação dos chamados' })).toHaveText(/21 registros\s*Página 2/);
    await page.getByRole('button', { name: 'Anterior', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Paginação dos chamados' })).toHaveText(/21 registros\s*Página 1/);
    if (path === '/requests') {
      for (const mode of ['Tabela', 'Lista', 'Cards']) {
        await view.click();
        await page.getByRole('option', { name: mode, exact: true }).click();
        for (const theme of ['light', 'dark']) {
          await page.evaluate(theme => { document.documentElement.classList.remove('light', 'dark'); document.documentElement.classList.add(theme); }, theme);
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
          await page.screenshot({ path: `.local/ticket-view-full-${mode}-${theme}-${testInfo.project.name}.png`, fullPage: true });
        }
      }
    }
  }
});

test('visualização preserva estados vazio, erro e recuperação', async ({ page }) => {
  let fail = false;
  await page.route('**/api/tickets/mine?**', route => fail
    ? route.fulfill({ status: 403, json: { error: 'Acesso negado.' } })
    : route.fulfill({ status: 200, json: { items: [], total: 0, page: 1, pageSize: 20 } }));
  await page.goto('/requests');
  for (const mode of ['Lista', 'Cards', 'Tabela']) {
    await page.getByRole('combobox', { name: 'Visualização dos chamados' }).click();
    await page.getByRole('option', { name: mode, exact: true }).click();
    await expect(page.getByText('Nenhum chamado encontrado para estes filtros.')).toBeVisible();
  }
  fail = true;
  await page.getByRole('button', { name: 'Atualizar lista', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Conteúdo indisponível ou acesso não permitido.');
  fail = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByText('Nenhum chamado encontrado para estes filtros.')).toBeVisible();
});
