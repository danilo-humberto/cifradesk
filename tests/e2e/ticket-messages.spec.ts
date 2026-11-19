import { createHash, randomUUID } from 'node:crypto';
import type { APIRequestContext, Browser, Page } from '@playwright/test';
import { test, expect, syntheticPassword } from './fixtures';
import { database } from '../../packages/database/src';
import { createTicket } from '../../packages/infrastructure/src/tickets';
import { acceptInvitation } from '../../packages/infrastructure/src/identity';

test.setTimeout(90000);

async function ticketFor(userId: string, member = true) {
  const origin = await database().department.create({ data: { name: 'Origem ' + randomUUID().slice(0, 8), memberships: { create: { userId } } } });
  const department = member ? origin : await database().department.create({ data: { name: 'Conversa ' + randomUUID().slice(0, 8) } });
  const actor = await database().user.findUniqueOrThrow({ where: { id: userId } });
  const ticket = await createTicket(actor, { title: 'Conversa sintética', description: 'Atendimento com conversa', requestedFor: 'SELF', originDepartmentId: origin.id, departmentId: department.id });
  return { ...ticket, department };
}
async function send(request: APIRequestContext, baseURL: string, ticketId: string, markdown: string, visibility = 'SHARED') {
  const response = await request.post(`/api/tickets/${ticketId}/messages`, { headers: { Origin: baseURL }, multipart: { markdown, visibility, submissionId: randomUUID() } });
  expect(response.status()).toBe(201);
  return response.json() as Promise<{ id: string; version: number }>;
}
async function signedViewer(browser: Browser, baseURL: string, departmentId?: string, isAdmin = false) {
  const user = await database().user.create({ data: { id: randomUUID(), name: 'Pessoa sintética', email: randomUUID() + '@example.test', isAdmin, ...(departmentId ? { memberships: { create: { departmentId } } } : {}) } });
  const token = randomUUID() + randomUUID();
  await database().invitation.create({ data: { userId: user.id, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 60000) } });
  await acceptInvitation(token, syntheticPassword);
  const context = await browser.newContext({ baseURL });
  expect((await context.request.post('/api/auth/sign-in/email', { headers: { Origin: baseURL }, data: { email: user.email, password: syntheticPassword } })).status()).toBe(200);
  return context;
}
const conversation = (page: Page) => page.getByRole('region', { name: 'Conversa do chamado', exact: true });
const composer = (page: Page) => page.getByRole('form', { name: 'Nova mensagem', exact: true });
const message = (page: Page, text: string) => conversation(page).getByRole('article').filter({ hasText: text });
const file = { name: 'conversa.txt', mimeType: 'text/plain', buffer: Buffer.from('Arquivo sintético da conversa') };
const malicious = '# Título seguro\n\n- Primeiro\n- Segundo\n\n> Citação\n\n[Site](https://example.test) [Ataque](javascript:alert(1))\n\n![Espião](https://external.example.test/pixel.png)\n\n<script>window.__markdownAttack=1</script>\n<img src=x onerror="window.__markdownAttack=1">\n\n```js\nalert("texto, sem execução")\n```';

test('envia Markdown com prévia segura, recarrega e separa o histórico', async ({ page, identity }) => {
  const ticket = await ticketFor(identity.id);
  let externalRequests = 0;
  page.on('request', request => { if (request.url().includes('external.example.test')) externalRequests++; });
  await page.goto(`/requests/${ticket.id}`);
  await expect(conversation(page)).toBeVisible();
  await composer(page).getByLabel('Texto da mensagem').fill(malicious);
  await composer(page).getByRole('tab', { name: 'Prévia', exact: true }).click();
  await expect(composer(page).getByRole('heading', { name: 'Título seguro' })).toBeVisible();
  await expect(composer(page).locator('img, script, iframe')).toHaveCount(0);
  await expect(composer(page).locator('a[href^="javascript:"]')).toHaveCount(0);
  await composer(page).getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  await expect(message(page, 'Título seguro')).toHaveCount(1);
  await page.reload();
  await expect(message(page, 'Título seguro').getByText('E2E Admin', { exact: true })).toBeVisible();
  await expect(message(page, 'Título seguro').getByText('Mensagem compartilhada', { exact: true })).toBeVisible();
  await expect(message(page, 'Título seguro').locator('time')).toHaveCount(1);
  await expect(message(page, 'Título seguro').locator('img, script, iframe')).toHaveCount(0);
  expect(externalRequests).toBe(0);
  expect(await page.evaluate(() => '__markdownAttack' in window)).toBe(false);
  await expect(page.getByRole('heading', { name: 'Histórico operacional' })).toBeVisible();
  await page.getByRole('button', { name: 'Atualizar chamado', exact: true }).click();
  await expect(message(page, 'Título seguro')).toHaveCount(1);
});

test('jornada de solicitante, integrante, terceiro e administrador isola nota e arquivo internos', async ({ page, browser, request, identity, baseURL }) => {
  const ticket = await ticketFor(identity.id, false);
  await database().user.update({ where: { id: identity.id }, data: { isAdmin: false } });
  const member = await signedViewer(browser, baseURL!, ticket.department.id);
  const outsider = await signedViewer(browser, baseURL!);
  const admin = await signedViewer(browser, baseURL!, undefined, true);
  try {
    for (const [viewer, isAdmin] of [[request, false], [member.request, false], [outsider.request, false], [admin.request, true]] as const) {
      expect(await (await viewer.get('/api/me')).json()).toMatchObject({ isAdmin });
    }
    const staff = await member.newPage();
    await staff.goto(`/requests/${ticket.id}`);
    await composer(staff).getByRole('combobox', { name: 'Visibilidade' }).click();
    await staff.getByRole('option', { name: 'Nota interna', exact: true }).click();
    await composer(staff).getByLabel('Texto da mensagem').fill('Nota reservada do setor');
    await composer(staff).getByLabel('Adicionar arquivos à mensagem').setInputFiles(file);
    await composer(staff).getByRole('button', { name: 'Enviar nota interna', exact: true }).click();
    await expect(message(staff, 'Nota reservada do setor').getByRole('link', { name: file.name })).toBeVisible();
    const internal = await database().ticketAttachment.findFirstOrThrow({ where: { ticketId: ticket.id } });
    await page.goto(`/requests/${ticket.id}`);
    await expect(composer(page).getByRole('combobox', { name: 'Visibilidade' })).toHaveCount(0);
    await expect(conversation(page)).not.toContainText('Nota reservada');
    await expect(conversation(page)).not.toContainText(file.name);
    expect((await request.get(`/api/tickets/${ticket.id}/messages`)).status()).toBe(200);
    expect((await (await request.get(`/api/tickets/${ticket.id}/messages`)).json()).total).toBe(0);
    expect((await request.get(`/api/tickets/${ticket.id}/attachments/${internal.id}`)).status()).toBe(404);
    await composer(page).getByLabel('Texto da mensagem').fill('Solicitação compartilhada');
    await composer(page).getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
    await expect(message(page, 'Solicitação compartilhada')).toBeVisible();
    await staff.getByRole('button', { name: 'Atualizar chamado', exact: true }).click();
    await expect(message(staff, 'Solicitação compartilhada')).toBeVisible();
    await composer(staff).getByRole('combobox', { name: 'Visibilidade' }).click();
    await staff.getByRole('option', { name: 'Mensagem compartilhada', exact: true }).click();
    await composer(staff).getByLabel('Texto da mensagem').fill('Resposta do integrante');
    await composer(staff).getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
    await expect(message(staff, 'Resposta do integrante')).toBeVisible();
    await page.reload();
    await expect(message(page, 'Resposta do integrante')).toBeVisible();
    await expect(conversation(page)).not.toContainText('Nota reservada');
    await expect(conversation(page)).not.toContainText(file.name);
    expect((await (await request.get(`/api/tickets/${ticket.id}/messages`)).json()).total).toBe(2);
    for (const viewer of [outsider, admin]) {
      const third = await viewer.newPage();
      await third.goto(`/requests/${ticket.id}`);
      await expect(third.getByRole('alert').filter({ hasText: 'acesso não permitido' })).toBeVisible();
      await expect(conversation(third)).toHaveCount(0);
      for (const path of ['messages', 'attachments', `attachments/${internal.id}`, `messages/${internal.messageId}/revisions`]) {
        expect((await viewer.request.get(`/api/tickets/${ticket.id}/${path}`)).status()).toBe(404);
      }
      expect((await viewer.request.post(`/api/tickets/${ticket.id}/messages`, { headers: { Origin: baseURL! }, multipart: { markdown: 'Envio sem acesso', visibility: 'SHARED', submissionId: randomUUID() } })).status()).toBe(404);
    }
    await database().departmentMembership.deleteMany({ where: { departmentId: ticket.department.id } });
    await staff.getByRole('button', { name: 'Atualizar chamado', exact: true }).click();
    await expect(staff.getByRole('alert').filter({ hasText: 'acesso não permitido' })).toBeVisible();
    await expect(conversation(staff)).toHaveCount(0);
  } finally { await member.close(); await outsider.close(); await admin.close(); }
});

test('edita texto e arquivos, mostra versões seguras, remove download e exclui com marcador', async ({ page, identity, request }) => {
  const ticket = await ticketFor(identity.id);
  await page.goto(`/requests/${ticket.id}`);
  await composer(page).getByLabel('Texto da mensagem').fill(malicious);
  await composer(page).getByLabel('Adicionar arquivos à mensagem').setInputFiles(file);
  await composer(page).getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  const initial = message(page, 'Título seguro');
  await expect(initial.getByRole('link', { name: file.name })).toBeVisible();
  const download = await initial.getByRole('link', { name: file.name }).getAttribute('href');
  expect((await request.get(download!)).status()).toBe(200);
  await initial.getByRole('button', { name: 'Editar', exact: true }).click();
  const editor = page.getByRole('form', { name: 'Editar mensagem', exact: true });
  await editor.getByLabel('Texto da mensagem').fill('Mensagem corrigida');
  await editor.getByRole('button', { name: `Remover ${file.name}`, exact: true }).click();
  await editor.getByLabel('Adicionar arquivos à mensagem').setInputFiles({ ...file, name: 'novo.txt' });
  await editor.getByRole('button', { name: 'Salvar mensagem', exact: true }).click();
  const updated = message(page, 'Mensagem corrigida');
  await expect(updated.getByText('Editada', { exact: true })).toBeVisible();
  await expect(updated.getByRole('link', { name: 'novo.txt' })).toBeVisible();
  const newDownload = await updated.getByRole('link', { name: 'novo.txt' }).getAttribute('href');
  expect((await request.get(download!)).status()).toBe(404);
  await updated.getByRole('button', { name: 'Versões', exact: true }).click();
  const versions = page.getByRole('dialog', { name: 'Versões da mensagem' });
  await expect(versions.getByText('Versão 1', { exact: true })).toBeVisible();
  await expect(versions.getByText(`${file.name} · Indisponível`, { exact: true })).toBeVisible();
  await expect(versions.getByRole('link', { name: file.name })).toHaveCount(0);
  await expect(versions.locator('img, script, iframe, a[href^="javascript:"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(updated.getByRole('button', { name: 'Versões', exact: true })).toBeFocused();
  await updated.getByRole('button', { name: 'Excluir', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir mensagem', exact: true }).click();
  await expect(conversation(page).getByText('Mensagem excluída.', { exact: true })).toBeVisible();
  await expect(conversation(page).getByRole('button', { name: 'Versões', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(conversation(page)).not.toContainText('Mensagem corrigida');
  await expect(conversation(page).getByRole('link', { name: 'novo.txt' })).toHaveCount(0);
  const deleted = await database().ticketMessage.findFirstOrThrow({ where: { ticketId: ticket.id } });
  expect((await request.get(`/api/tickets/${ticket.id}/messages/${deleted.id}/revisions`)).status()).toBe(404);
  expect((await request.get(newDownload!)).status()).toBe(404);
});

test('conflito entre duas sessões preserva o rascunho e exige conciliação explícita', async ({ page, context, browser, request, identity, baseURL }) => {
  const ticket = await ticketFor(identity.id);
  await send(request, baseURL!, ticket.id, 'Versão inicial');
  const otherContext = await browser.newContext({ baseURL, storageState: await context.storageState() });
  try {
    const other = await otherContext.newPage();
    for (const editor of [page, other]) {
      await editor.goto(`/requests/${ticket.id}`);
      await message(editor, 'Versão inicial').getByRole('button', { name: 'Editar', exact: true }).click();
    }
    await page.getByRole('form', { name: 'Editar mensagem', exact: true }).getByLabel('Texto da mensagem').fill('Primeira correção');
    await other.getByRole('form', { name: 'Editar mensagem', exact: true }).getByLabel('Texto da mensagem').fill('Rascunho da segunda sessão');
    await page.getByRole('button', { name: 'Salvar mensagem', exact: true }).click();
    await expect(message(page, 'Primeira correção')).toBeVisible();
    await other.getByRole('button', { name: 'Salvar mensagem', exact: true }).click();
    const editor = other.getByRole('form', { name: 'Editar mensagem', exact: true });
    await expect(editor.getByRole('alert')).toContainText('Confira a versão atual');
    await expect(editor.getByLabel('Texto da mensagem')).toHaveValue('Rascunho da segunda sessão');
    await expect(editor.getByRole('button', { name: 'Salvar mensagem', exact: true })).toBeDisabled();
    await other.getByRole('button', { name: 'Atualizar chamado', exact: true }).click();
    await expect(editor.getByLabel('Texto da mensagem')).toHaveValue('Rascunho da segunda sessão');
    await expect(editor.getByRole('button', { name: 'Salvar mensagem', exact: true })).toBeDisabled();
    await editor.getByRole('button', { name: 'Conferir versão atual', exact: true }).click();
    await expect(editor.getByText('Primeira correção', { exact: true })).toBeVisible();
    await editor.getByRole('button', { name: 'Usar versão atual como base', exact: true }).click();
    await editor.getByRole('button', { name: 'Salvar mensagem', exact: true }).click();
    await expect(message(other, 'Rascunho da segunda sessão')).toBeVisible();
    expect((await database().ticketMessage.findFirstOrThrow({ where: { ticketId: ticket.id } })).version).toBe(3);
  } finally { await otherContext.close(); }
});

test('perda da resposta preserva texto e arquivo e repete o mesmo envio sem duplicar', async ({ page, identity }) => {
  const ticket = await ticketFor(identity.id);
  let failed = false;
  await page.route(`**/api/tickets/${ticket.id}/messages`, async route => {
    if (route.request().method() !== 'POST' || failed) return route.continue();
    failed = true;
    expect((await route.fetch()).status()).toBe(201);
    return route.abort('connectionfailed');
  });
  await page.goto(`/requests/${ticket.id}`);
  await composer(page).getByLabel('Texto da mensagem').fill('Rascunho preservado');
  await composer(page).getByLabel('Adicionar arquivos à mensagem').setInputFiles(file);
  await composer(page).getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  await expect(composer(page).getByRole('alert')).toBeVisible();
  await expect(composer(page).getByLabel('Texto da mensagem')).toHaveValue('Rascunho preservado');
  await expect(composer(page).getByRole('list', { name: 'Arquivos da mensagem' })).toContainText(file.name);
  await composer(page).getByRole('button', { name: 'Tentar o mesmo envio', exact: true }).click();
  await expect(composer(page).getByLabel('Texto da mensagem')).toHaveValue('');
  expect(await database().ticketMessage.count({ where: { ticketId: ticket.id } })).toBe(1);
  expect(await database().ticketAttachment.count({ where: { ticketId: ticket.id, status: 'AVAILABLE' } })).toBe(1);
  await expect(message(page, 'Rascunho preservado')).toHaveCount(1);
});

test('falha de edição conserva rascunho e consulta antes de reaplicar resposta perdida', async ({ page, request, identity, baseURL }) => {
  const ticket = await ticketFor(identity.id);
  const saved = await send(request, baseURL!, ticket.id, 'Texto anterior');
  let attempts = 0;
  await page.route(`**/api/tickets/${ticket.id}/messages/${saved.id}`, async route => {
    if (route.request().method() !== 'PATCH') return route.continue();
    attempts++;
    expect((await route.fetch()).status()).toBe(200);
    return route.abort('connectionfailed');
  });
  await page.goto(`/requests/${ticket.id}`);
  await message(page, 'Texto anterior').getByRole('button', { name: 'Editar', exact: true }).click();
  const editor = page.getByRole('form', { name: 'Editar mensagem', exact: true });
  await editor.getByLabel('Texto da mensagem').fill('Edição com resposta perdida');
  await editor.getByRole('button', { name: 'Salvar mensagem', exact: true }).click();
  await expect(editor.getByRole('alert')).toBeVisible();
  await expect(editor.getByLabel('Texto da mensagem')).toHaveValue('Edição com resposta perdida');
  await expect(editor.getByRole('button', { name: 'Salvar mensagem', exact: true })).toBeDisabled();
  await editor.getByRole('button', { name: 'Conferir versão atual', exact: true }).click();
  await expect(editor.getByText('Edição com resposta perdida', { exact: true })).toBeVisible();
  expect(attempts).toBe(1);
  await editor.getByRole('button', { name: 'Cancelar edição', exact: true }).click();
  await expect(message(page, 'Edição com resposta perdida')).toBeVisible();
  await expect(message(page, 'Edição com resposta perdida').getByRole('button', { name: 'Editar', exact: true })).toBeFocused();
});

test('página de conversa, somente arquivos, chamado fechado e setor desativado', async ({ page, identity }) => {
  const ticket = await ticketFor(identity.id);
  await database().ticketMessage.createMany({ data: Array.from({ length: 21 }, (_, index) => ({ ticketId: ticket.id, authorId: identity.id, markdown: `Mensagem paginada ${String(index).padStart(2, '0')}`, visibility: 'SHARED' as const, createdAt: new Date(Date.now() - (21 - index) * 1000) })) });
  await page.goto(`/requests/${ticket.id}`);
  await expect(conversation(page).getByRole('article')).toHaveCount(20);
  await conversation(page).getByRole('navigation', { name: 'Paginação da conversa' }).getByRole('button', { name: 'Próxima' }).click();
  await expect(message(page, 'Mensagem paginada 00')).toBeVisible();
  await expect(conversation(page).getByRole('article')).toHaveCount(1);
  await database().ticket.update({ where: { id: ticket.id }, data: { status: 'CLOSED' } });
  await page.getByRole('button', { name: 'Atualizar chamado', exact: true }).click();
  await composer(page).getByLabel('Adicionar arquivos à mensagem').setInputFiles(file);
  await composer(page).getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  await expect(conversation(page).getByRole('link', { name: file.name })).toBeVisible();
  await expect(conversation(page).getByRole('navigation', { name: 'Paginação da conversa' })).toContainText('Página 1');
  await database().department.update({ where: { id: ticket.department.id }, data: { active: false } });
  await page.getByRole('button', { name: 'Atualizar chamado', exact: true }).click();
  await expect(composer(page)).toHaveCount(0);
  await expect(conversation(page)).toContainText('somente para leitura');
  await expect(conversation(page).getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0);
});

test('validação, teclado, foco, temas e tela pequena', async ({ page, identity }, testInfo) => {
  const ticket = await ticketFor(identity.id);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/requests/${ticket.id}`);
  await composer(page).getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  await expect(composer(page).getByRole('alert')).toContainText('Escreva uma mensagem ou adicione um arquivo');
  await expect(composer(page).getByLabel('Texto da mensagem')).toBeFocused();
  await composer(page).getByLabel('Texto da mensagem').fill('Texto pelo teclado\ncom segunda linha');
  await composer(page).getByRole('tab', { name: 'Escrever', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(composer(page).getByRole('tab', { name: 'Prévia', exact: true })).toHaveAttribute('data-state', 'active');
  await page.keyboard.press('ArrowLeft');
  await expect(composer(page).getByRole('tab', { name: 'Escrever', exact: true })).toHaveAttribute('data-state', 'active');
  await composer(page).getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  await expect(message(page, 'Texto pelo teclado')).toBeVisible();
  await expect(composer(page).getByLabel('Texto da mensagem')).toBeFocused();
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => { document.documentElement.classList.remove('light', 'dark'); document.documentElement.classList.add(value); }, theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await composer(page).getByRole('button', { name: 'Enviar mensagem', exact: true }).evaluate(element => getComputedStyle(element).cursor)).toBe('pointer');
    await conversation(page).screenshot({ path: `.local/conversation-${testInfo.project.name}-${theme}.png` });
    await conversation(page).getByRole('heading', { name: 'Conversa', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.local/conversation-viewport-${testInfo.project.name}-${theme}.png` });
  }
});

test('integrante lê sem editar mensagem alheia e exclusão usa a versão confirmada', async ({ page, request, browser, identity, baseURL }) => {
  const ticket = await ticketFor(identity.id);
  const saved = await send(request, baseURL!, ticket.id, 'Mensagem do solicitante');
  const member = await signedViewer(browser, baseURL!, ticket.department.id);
  try {
    const staff = await member.newPage();
    await staff.goto(`/requests/${ticket.id}`);
    await expect(message(staff, 'Mensagem do solicitante').getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0);
    await expect(message(staff, 'Mensagem do solicitante').getByRole('button', { name: 'Excluir', exact: true })).toHaveCount(0);
    await expect(message(staff, 'Mensagem do solicitante').getByRole('button', { name: 'Versões', exact: true })).toBeVisible();
    await page.goto(`/requests/${ticket.id}`);
    await message(page, 'Mensagem do solicitante').getByRole('button', { name: 'Excluir', exact: true }).click();
    const changed = await request.patch(`/api/tickets/${ticket.id}/messages/${saved.id}`, { headers: { Origin: baseURL! }, multipart: { expectedVersion: '1', markdown: 'Alteração antes de excluir', retainedAttachmentIds: '[]' } });
    expect(changed.status()).toBe(200);
    await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir mensagem', exact: true }).click();
    await expect(page.getByRole('alertdialog').getByRole('alert')).toContainText('Confira a conversa');
    expect((await database().ticketMessage.findUniqueOrThrow({ where: { id: saved.id } })).deletedAt).toBeNull();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Conferir conversa', exact: true }).click();
    await expect(message(page, 'Alteração antes de excluir')).toBeVisible();
  } finally { await member.close(); }
});

test('rejeição de upload mantém rascunho editável e erro de consulta não o apaga', async ({ page, identity }) => {
  const ticket = await ticketFor(identity.id);
  let rejectUpload = true;
  let failRead = false;
  await page.route(`**/api/tickets/${ticket.id}/messages*`, async route => {
    if (route.request().method() === 'POST' && rejectUpload) return route.fulfill({ status: 400, json: { error: 'Arquivo recusado pelo teste.' } });
    if (route.request().method() === 'GET' && failRead) return route.fulfill({ status: 503, json: { error: 'Consulta temporariamente indisponível.' } });
    return route.continue();
  });
  await page.route(`**/api/tickets/${ticket.id}`, route => failRead ? route.fulfill({ status: 503, json: { error: 'Detalhe temporariamente indisponível.' } }) : route.continue());
  await page.goto(`/requests/${ticket.id}`);
  await composer(page).getByLabel('Texto da mensagem').fill('Rascunho com falha');
  await composer(page).getByLabel('Adicionar arquivos à mensagem').setInputFiles(file);
  await composer(page).getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  await expect(composer(page).getByRole('alert')).toContainText('Arquivo recusado');
  await expect(composer(page).getByLabel('Texto da mensagem')).toBeEditable();
  await composer(page).getByRole('button', { name: `Remover ${file.name}`, exact: true }).click();
  failRead = true;
  await page.getByRole('button', { name: 'Atualizar chamado', exact: true }).click();
  await expect(conversation(page).getByRole('alert').filter({ hasText: 'Consulta temporariamente' })).toBeVisible();
  await expect(composer(page).getByLabel('Texto da mensagem')).toHaveValue('Rascunho com falha');
  rejectUpload = false; failRead = false;
  await composer(page).getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  await expect(message(page, 'Rascunho com falha')).toHaveCount(1);
});

test('perda parcial de capacidade libera edição e permite revisar visibilidade do rascunho', async ({ page, request, identity, baseURL }) => {
  const ticket = await ticketFor(identity.id);
  await database().ticketMessage.createMany({ data: Array.from({ length: 21 }, (_, index) => ({ ticketId: ticket.id, authorId: identity.id, markdown: `Mensagem antiga ${index}`, visibility: 'SHARED' as const, createdAt: new Date(Date.now() - (21 - index) * 1000) })) });
  await send(request, baseURL!, ticket.id, 'Mensagem compartilhada atual');
  await send(request, baseURL!, ticket.id, 'Nota interna publicada', 'INTERNAL');
  await page.goto(`/requests/${ticket.id}`);
  await composer(page).getByRole('combobox', { name: 'Visibilidade' }).click();
  await page.getByRole('option', { name: 'Nota interna', exact: true }).click();
  await composer(page).getByLabel('Texto da mensagem').fill('Rascunho interno privado');
  await message(page, 'Nota interna publicada').getByRole('button', { name: 'Editar', exact: true }).click();
  await database().departmentMembership.deleteMany({ where: { userId: identity.id, departmentId: ticket.department.id } });
  await page.getByRole('button', { name: 'Atualizar chamado', exact: true }).click();
  await expect(conversation(page).getByRole('article').filter({ hasText: 'Nota interna publicada' })).toHaveCount(0);
  await expect(page.getByRole('form', { name: 'Editar mensagem', exact: true })).toHaveCount(0);
  await expect(conversation(page).getByRole('button', { name: 'Encerrar edição', exact: true })).toBeVisible();
  await conversation(page).getByRole('button', { name: 'Encerrar edição', exact: true }).click();
  const navigation = conversation(page).getByRole('navigation', { name: 'Paginação da conversa' });
  await expect(navigation.getByRole('button', { name: 'Próxima' })).toBeEnabled();
  await expect(message(page, 'Mensagem compartilhada atual').getByRole('button', { name: 'Editar', exact: true })).toBeEnabled();
  await expect(composer(page).getByLabel('Texto da mensagem')).toHaveValue('Rascunho interno privado');
  await expect(composer(page).getByRole('button', { name: 'Enviar nota interna', exact: true })).toBeDisabled();
  await composer(page).getByRole('combobox', { name: 'Visibilidade' }).click();
  await page.getByRole('option', { name: 'Mensagem compartilhada', exact: true }).click();
  await expect(composer(page).getByLabel('Texto da mensagem')).toHaveValue('Rascunho interno privado');
  await composer(page).getByLabel('Texto da mensagem').fill('Compartilhado após revisar');
  await composer(page).getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  await expect(message(page, 'Compartilhado após revisar')).toBeVisible();
  await message(page, 'Mensagem compartilhada atual').getByRole('button', { name: 'Editar', exact: true }).click();
  await database().ticket.update({ where: { id: ticket.id }, data: { status: 'CLOSED' } });
  await database().department.update({ where: { id: ticket.department.id }, data: { active: false } });
  await page.getByRole('button', { name: 'Atualizar chamado', exact: true }).click();
  await expect(page.getByRole('form', { name: 'Editar mensagem', exact: true })).toHaveCount(0);
  await expect(conversation(page).getByRole('button', { name: 'Encerrar edição', exact: true })).toBeVisible();
  await conversation(page).getByRole('button', { name: 'Encerrar edição', exact: true }).click();
  await expect(navigation.getByRole('button', { name: 'Próxima' })).toBeEnabled();
  await expect(composer(page)).toHaveCount(0);
});
