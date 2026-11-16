import { createHash, randomUUID } from 'node:crypto';
import { test, expect, syntheticPassword } from './fixtures';
import { database } from '../../packages/database/src';
import { createTicket } from '../../packages/infrastructure/src/tickets';
import { acceptInvitation } from '../../packages/infrastructure/src/identity';

// These journeys include several authenticated writes on the synthetic server.
test.setTimeout(90000);

async function department(userId?: string) {
  return database().department.create({ data: { name: 'Setor ' + randomUUID().slice(0, 8), ...(userId ? { memberships: { create: { userId } } } : {}) } });
}
test('abertura para outra pessoa, departamento único, detalhe e lista', async ({ page, identity }, testInfo) => {
  const origin = await department(identity.id);
  await page.goto('/requests/new');
  await expect(page.getByLabel('Qual seu departamento?')).toHaveValue(origin.name);
  await page.getByLabel('Informe o que deseja?').fill('Atendimento de teste');
  await page.getByLabel('Descreva sua requisição').fill('Descrição sintética do atendimento');
  await page.getByRole('combobox', { name: 'Para quem é o atendimento?' }).click();
  await page.getByRole('option', { name: 'Para outra pessoa' }).click();
  await page.getByLabel('Informe seu nome completo').fill('Ágata de Sá');
  await page.getByRole('combobox', { name: 'De qual setor deseja o atendimento?' }).click();
  await page.getByRole('option', { name: origin.name, exact: true }).click();
  await page.getByRole('button', { name: 'Criar chamado', exact: true }).click();
  await expect(page.getByRole('heading', { name: /CH-.*Atendimento de teste/ })).toBeVisible();
  await expect(page.getByText('Ágata de Sá', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Minhas solicitações', exact: true }).last().click();
  await expect(page.getByRole('link', { name: /CH-.*Atendimento de teste/ })).toBeVisible();
  await page.screenshot({ path: `.local/tickets-list-${testInfo.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test('sem vínculo orienta procurar administrador; múltiplos exigem escolha', async ({ page, identity }) => {
  await page.goto('/requests/new');
  await expect(page.getByRole('alert').filter({ hasText: 'Procure o administrador' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar chamado' })).toHaveCount(0);
  const first = await department(identity.id); const second = await department(identity.id);
  await page.reload();
  const select = page.getByRole('combobox', { name: 'Qual seu departamento?' });
  await expect(select).toContainText('Escolha uma opção');
  await select.focus(); await page.keyboard.press('Space');
  await expect(page.getByRole('option', { name: first.name })).toBeVisible();
  await expect(page.getByRole('option', { name: second.name })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(select).toBeFocused();
});
test('responsáveis múltiplos, fechamento, filtro e conflito sem reenvio', async ({ page, request, identity, baseURL }) => {
  const sector = await department(identity.id);
  const other = await database().user.create({ data: { id: randomUUID(), name: 'Ágata de Sá', email: randomUUID() + '@example.test', status: 'ACTIVE', memberships: { create: { departmentId: sector.id } } } });
  const actor = await database().user.findUniqueOrThrow({ where: { id: identity.id } });
  const ticket = await createTicket(actor, { title: 'Conflito sintético', description: 'Descrição sintética do conflito', requestedFor: 'SELF', originDepartmentId: sector.id, departmentId: sector.id });
  await page.goto(`/requests/${ticket.id}`);
  await page.getByRole('combobox', { name: 'Ação', exact: true }).click();
  await page.getByRole('option', { name: 'Definir responsáveis' }).click();
  await page.getByRole('checkbox', { name: 'E2E Admin' }).check();
  await page.getByRole('checkbox', { name: other.name }).check();
  await page.getByRole('button', { name: 'Salvar alteração' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Dados atualizados.' })).toBeVisible();
  await expect(page.locator('dd').getByRole('img', { name: 'Ágata de Sá' })).toBeVisible();
  // Another session changes the version after this editor has loaded.
  const response = await request.post(`/api/tickets/${ticket.id}/operations/update`, { headers: { Origin: baseURL! }, data: { expectedVersion: 2, priority: 'HIGH' } });
  expect(response.status()).toBe(200);
  await page.getByRole('combobox', { name: 'Novo status' }).click();
  await page.getByRole('option', { name: 'FECHADA', exact: true }).click();
  await page.getByLabel('Motivo (interno, obrigatório)').fill('Encerrado pelo teste');
  await page.getByRole('button', { name: 'Salvar alteração' }).click();
  await expect(page.getByText('O chamado mudou. Recarregue antes de editar.', { exact: true })).toBeVisible();
  expect((await database().ticket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe('OPEN');
  await page.getByRole('button', { name: 'Recarregar chamado', exact: true }).click();
  await page.getByRole('combobox', { name: 'Novo status' }).click();
  await page.getByRole('option', { name: 'FECHADA', exact: true }).click();
  await page.getByLabel('Motivo (interno, obrigatório)').fill('Encerrado após revisar');
  const closed = page.waitForResponse(response => response.url().endsWith(`/api/tickets/${ticket.id}/operations/status`) && response.status() === 200);
  await page.getByRole('button', { name: 'Salvar alteração' }).click();
  await closed;
  await expect.poll(async () => (await database().ticket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe('CLOSED');
  await expect(page.getByText('FECHADA', { exact: true }).first()).toBeVisible();
  await page.goto('/requests');
  await expect(page.getByText('Nenhum chamado encontrado para estes filtros.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Conflito sintético/ })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Filtrar por status' }).click();
  await page.getByRole('option', { name: 'FECHADA', exact: true }).click();
  await expect(page.getByRole('link', { name: /Conflito sintético/ })).toBeVisible();
});
test('criador acompanha outro setor sem ações; terceiro não lê o detalhe', async ({ page, identity }) => {
  const origin = await department(identity.id); const destination = await department();
  const actor = await database().user.findUniqueOrThrow({ where: { id: identity.id } });
  const ticket = await createTicket(actor, { title: 'Solicitação externa', description: 'Atendimento em outro setor', requestedFor: 'SELF', originDepartmentId: origin.id, departmentId: destination.id });
  await page.goto(`/requests/${ticket.id}`);
  await expect(page.getByText('Você pode acompanhar este chamado.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar alteração' })).toHaveCount(0);
  await page.goto('/departments');
  await expect(page.getByRole('link', { name: /Solicitação externa/ })).toHaveCount(0);
  await database().ticket.update({ where: { id: ticket.id }, data: { createdById: (await database().user.create({ data: { id: randomUUID(), email: randomUUID() + '@example.test', name: 'Terceiro', status: 'ACTIVE' } })).id } });
  await page.goto(`/requests/${ticket.id}`);
  await expect(page.getByRole('alert').filter({ hasText: 'acesso não permitido' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Solicitação externa/ })).toHaveCount(0);
});
test('erro de anexos permite recuperação sem duplicar abertura', async ({ page, identity }) => {
  const sector = await department(identity.id);
  let attempts = 0;
  await page.route('**/api/tickets/*/attachments', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    attempts++;
    if (attempts === 1) return route.fulfill({ status: 500, json: { error: 'Falha sintética de upload.' } });
    const ticketId = new URL(route.request().url()).pathname.split('/')[3]!;
    await database().ticketAttachment.create({ data: { ticketId, uploadedById: identity.id, originalName: 'teste.txt', mimeType: 'text/plain', size: 20, status: 'AVAILABLE', objectKey: randomUUID() } });
    return route.fulfill({ status: 201, json: { items: [] } });
  });
  await page.goto('/requests/new');
  await page.getByLabel('Informe o que deseja?').fill('Teste com anexo');
  await page.getByLabel('Descreva sua requisição').fill('Descrição sintética do anexo');
  await page.getByRole('combobox', { name: 'De qual setor deseja o atendimento?' }).click();
  await page.getByRole('option', { name: sector.name }).click();
  await page.getByLabel('Anexe algum arquivo').setInputFiles({ name: 'teste.txt', mimeType: 'text/plain', buffer: Buffer.from('conteúdo sintético') });
  await page.getByRole('button', { name: 'Criar chamado', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'já foi criado' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Conferir chamado e anexos' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar chamado' })).toHaveCount(0);
  expect(await database().ticket.count({ where: { createdById: identity.id } })).toBe(1);
  await page.getByRole('link', { name: 'Conferir chamado e anexos' }).click();
  await page.getByLabel('Adicionar ou reenviar anexos').setInputFiles({ name: 'teste.txt', mimeType: 'text/plain', buffer: Buffer.from('conteúdo sintético') });
  await page.getByRole('button', { name: 'Enviar anexos', exact: true }).click();
  await expect(page.getByRole('link', { name: 'teste.txt', exact: true })).toBeVisible();
  expect(attempts).toBe(2);
  expect(await database().ticket.count({ where: { createdById: identity.id } })).toBe(1);
});
test('jornada respeita temas e encerra sessão sem conteúdo antigo', async ({ page, identity }, testInfo) => {
  await department(identity.id);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const [label, theme] of [['Claro', 'light'], ['Escuro', 'dark'], ['Automático', 'dark']] as const) {
    await page.goto('/settings');
    await page.getByRole('combobox', { name: 'Tema da interface' }).click();
    await page.getByRole('option', { name: new RegExp('^' + label) }).click();
    await expect(page.locator('html')).toHaveClass(theme);
    await page.goto('/requests/new');
    await expect(page.getByLabel('Informe o que deseja?')).toBeVisible();
    await expect(page.locator('html')).toHaveClass(theme);
  }
  await page.screenshot({ path: `.local/tickets-opening-${testInfo.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/requests');
  await expect(page).toHaveURL(/\/login$/);
});

test('duas sessões de navegador preservam a primeira edição e exigem recarga', async ({ page, browser, identity, baseURL }) => {
  const sector = await department(identity.id);
  const actor = await database().user.findUniqueOrThrow({ where: { id: identity.id } });
  const ticket = await createTicket(actor, { title: 'Duas sessões reais', description: 'Concorrência entre navegadores', requestedFor: 'SELF', originDepartmentId: sector.id, departmentId: sector.id });
  const second = await browser.newContext({ baseURL });
  try {
    expect((await second.request.post('/api/auth/sign-in/email', { headers: { Origin: baseURL! }, data: { email: identity.email, password: syntheticPassword } })).status()).toBe(200);
    const other = await second.newPage();
    for (const editor of [page, other]) {
      await editor.goto(`/requests/${ticket.id}`);
      await editor.getByRole('combobox', { name: 'Novo status' }).click();
      await editor.getByRole('option', { name: 'PENDENTE', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Salvar alteração' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Dados atualizados.' })).toBeVisible();
    const conflict = other.waitForResponse(response => response.url().endsWith(`/api/tickets/${ticket.id}/operations/status`) && response.status() === 409);
    await other.getByRole('button', { name: 'Salvar alteração' }).click();
    await conflict;
    await expect(other.getByText('O chamado mudou. Recarregue antes de editar.', { exact: true })).toBeVisible();
    await expect(other.getByRole('button', { name: 'Salvar alteração' })).toBeDisabled();
    const saved = await database().ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(saved.version).toBe(2);
    expect(saved.status).toBe('PENDING');
    expect(await database().ticketActivity.count({ where: { ticketId: ticket.id } })).toBe(2);
    expect(await database().outboxEvent.count({ where: { ticketId: ticket.id } })).toBe(2);
    await other.getByRole('button', { name: 'Recarregar chamado', exact: true }).click();
    await expect(other.getByRole('combobox', { name: 'Novo status' })).toContainText('PENDENTE');
  } finally { await second.close(); }
});

test('terceiro é negado; vínculo permite operar; desativação revoga a sessão aberta', async ({ browser, request, identity, baseURL }) => {
  const sector = await department(identity.id);
  const actor = await database().user.findUniqueOrThrow({ where: { id: identity.id } });
  const ticket = await createTicket(actor, { title: 'Revogação em navegador', description: 'Acesso reavaliado pelo servidor', requestedFor: 'SELF', originDepartmentId: sector.id, departmentId: sector.id });
  const user = await database().user.create({ data: { id: randomUUID(), name: 'Integrante sintético', email: randomUUID() + '@example.test' } });
  const token = randomUUID() + randomUUID();
  await database().invitation.create({ data: { userId: user.id, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 60000) } });
  await acceptInvitation(token, syntheticPassword);
  const member = await browser.newContext({ baseURL });
  try {
    expect((await member.request.post('/api/auth/sign-in/email', { headers: { Origin: baseURL! }, data: { email: user.email, password: syntheticPassword } })).status()).toBe(200);
    const viewer = await member.newPage();
    await viewer.goto(`/requests/${ticket.id}`);
    await expect(viewer.getByRole('alert').filter({ hasText: 'acesso não permitido' })).toBeVisible();
    await expect(viewer.getByRole('heading', { name: /Revogação em navegador/ })).toHaveCount(0);
    expect((await request.post(`/api/admin/departments/${sector.id}/members`, { headers: { Origin: baseURL! }, data: { userId: user.id } })).status()).toBe(200);
    await viewer.reload();
    await viewer.getByRole('combobox', { name: 'Novo status' }).click();
    await viewer.getByRole('option', { name: 'PENDENTE', exact: true }).click();
    await viewer.getByRole('button', { name: 'Salvar alteração' }).click();
    await expect(viewer.getByRole('status').filter({ hasText: 'Dados atualizados.' })).toBeVisible();
    expect((await request.patch(`/api/admin/users/${user.id}`, { headers: { Origin: baseURL! }, data: { status: 'DISABLED' } })).status()).toBe(200);
    expect((await member.request.get(`/api/tickets/${ticket.id}`)).status()).toBe(401);
    expect((await member.request.post(`/api/tickets/${ticket.id}/operations/status`, { headers: { Origin: baseURL! }, data: { expectedVersion: 2, status: 'OPEN' } })).status()).toBe(401);
    await viewer.reload();
    await expect(viewer).toHaveURL(/\/login$/);
    expect((await database().ticket.findUniqueOrThrow({ where: { id: ticket.id } })).version).toBe(2);
  } finally { await member.close(); }
});
