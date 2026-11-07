import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE_IMAGE = path.join(__dirname, 'fixtures', 'reference.png');

// Invariant 5: fully usable offline -- including a cold start with no network,
// which only the service worker makes possible for a hosted web app.
// Runs under playwright.pwa.config.ts against the production export.

test('cold-starts and imports a reference with no network once installed', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Artiso' })).toBeVisible();

  // The worker has installed (precached everything) and controls the page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Artiso' })).toBeVisible();

  // The whole local pipeline (decode, frame, IndexedDB, WebGL) works offline.
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  await (await fileChooserPromise).setFiles(FIXTURE_IMAGE);
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });
  await expect(page.getByTestId('zoom-readout')).toHaveText('100%');
});

test('ships a valid manifest and every icon it names', async ({ page }) => {
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'Artiso', display: 'standalone', start_url: '/' });
  const purposes = (manifest.icons as { purpose: string }[]).map((icon) => icon.purpose);
  expect(purposes).toContain('maskable');
  for (const icon of manifest.icons as { src: string }[]) {
    expect((await page.request.get(icon.src)).ok(), icon.src).toBe(true);
  }
});
