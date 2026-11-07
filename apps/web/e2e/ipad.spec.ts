import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { visibleCentre } from './visible-region';

const FIXTURE_IMAGE = path.join(__dirname, 'fixtures', 'reference.png');

// iPad, in Safari's engine, with touch: the two orientations land on different
// breakpoints (landscape 1194px = Wide, portrait 834px = Regular), and there is
// no mouse -- every interaction here is a tap or a two-finger gesture.
// Runs only in the `webkit` project (see playwright.config.ts).

const LANDSCAPE = { width: 1194, height: 834 };
const PORTRAIT = { width: 834, height: 1194 };

test.use({ hasTouch: true });

async function importFixture(page: Page) {
  await page.goto('/');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).tap();
  await (await fileChooserPromise).setFiles(FIXTURE_IMAGE);
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });
  await expect(page.getByTestId('zoom-pill')).toBeVisible();
}

// Two touch pointers spreading apart on the canvas under the visible centre.
// Playwright has no multi-touch API, so the Pointer Events the input
// controller listens for are dispatched directly.
async function pinchOut(page: Page) {
  const centre = await visibleCentre(page);
  await page.evaluate(({ x, y }) => {
    const target = document.elementFromPoint(x, y);
    if (!target) throw new Error('nothing under the visible centre');
    const fire = (type: string, pointerId: number, px: number) =>
      target.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: 'touch',
          isPrimary: pointerId === 1,
          clientX: px,
          clientY: y,
        }),
      );
    fire('pointerdown', 1, x - 20);
    fire('pointerdown', 2, x + 20);
    for (let step = 1; step <= 10; step++) {
      fire('pointermove', 1, x - 20 - step * 12);
      fire('pointermove', 2, x + 20 + step * 12);
    }
    fire('pointerup', 1, x - 140);
    fire('pointerup', 2, x + 140);
  }, centre);
}

const zoomPercent = async (page: Page) =>
  Number.parseInt((await page.getByTestId('zoom-readout').innerText()).replace('%', ''), 10);

test.describe('iPad landscape (Wide)', () => {
  test.use({ viewport: LANDSCAPE });

  test('imports, uses the rail and dock by touch, and pinch-zooms', async ({ page }) => {
    await importFixture(page);
    await expect(page.getByTestId('side-rail')).toBeVisible();
    await expect(page.getByTestId('tab-strip')).toBeVisible();
    await expect(page.getByTestId('bottom-toolbar')).toHaveCount(0);

    await page.getByRole('button', { name: 'Grid', exact: true }).tap();
    await expect(page.getByTestId('side-dock')).toHaveAttribute('aria-hidden', 'false');

    await expect(page.getByTestId('zoom-readout')).toHaveText('100%');
    await pinchOut(page);
    await expect.poll(() => zoomPercent(page)).toBeGreaterThan(100);
  });

  test('every rail control is at least 44px for a finger', async ({ page }) => {
    await importFixture(page);
    const buttons = page.getByTestId('side-rail').getByRole('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(3);
    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      if (!box) continue; // scrolled out of a short rail
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('iPad portrait (Regular)', () => {
  test.use({ viewport: PORTRAIT });

  test('keeps the rail, has no tabs, and leaves most of the photo uncovered', async ({ page }) => {
    await importFixture(page);
    await expect(page.getByTestId('side-rail')).toBeVisible();
    await expect(page.getByTestId('tab-strip')).toHaveCount(0);

    // Open a panel: the dock overlays, but the visible region stays usable.
    await page.getByRole('button', { name: 'Grid', exact: true }).tap();
    const pane = page.getByTestId('pane').first();
    const box = await pane.boundingBox();
    if (!box) throw new Error('pane has no bounding box');
    const left = Number(await pane.getAttribute('data-inset-left'));
    const right = Number(await pane.getAttribute('data-inset-right'));
    expect((box.width - left - right) / box.width).toBeGreaterThan(0.4);

    await pinchOut(page);
    await expect.poll(() => zoomPercent(page)).toBeGreaterThan(100);
  });
});

test('is set up as a home-screen web app', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png');
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]')).not.toHaveCount(0);
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);

  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  for (const icon of manifest.icons as { src: string }[]) {
    expect((await page.request.get(icon.src)).ok(), icon.src).toBe(true);
  }
});
