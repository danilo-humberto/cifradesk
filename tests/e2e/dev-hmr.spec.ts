import { test, expect } from '@playwright/test';

// Read-only smoke for a running local dev server; no login or database fixture.
test('HMR conectado não recarrega a página em repouso', async ({ page }) => {
  test.skip(process.env.E2E_DEV_SERVER !== '1', 'Executar somente contra next dev local.');
  test.setTimeout(90000);
  let navigations = 0;
  let connected = false;
  const reloads: string[] = [];
  // Next also updates history during hydration; count document loads, not replaceState.
  page.on('request', request => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++;
  });
  page.on('websocket', socket => socket.on('framereceived', frame => {
    try {
      const message = JSON.parse(String(frame.payload));
      if (message.type === 'sync') connected = true;
      if (message.type === 'reloadPage') reloads.push(String(message.data));
    } catch { /* Non-JSON frames are not HMR commands. */ }
  }));
  await page.goto('/login');
  await expect(page.getByLabel('E-mail', { exact: true })).toBeVisible();
  await expect.poll(() => connected).toBe(true);
  await page.getByLabel('E-mail', { exact: true }).fill('hmr-check@example.test');
  // A quiet observation window is intentional: the regression reloads without input.
  await page.waitForTimeout(15000);
  expect(reloads).toEqual([]);
  expect(navigations).toBe(1);
  await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue('hmr-check@example.test');
});
