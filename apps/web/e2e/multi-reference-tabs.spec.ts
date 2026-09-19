import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';

const FIXTURE_IMAGE = path.join(__dirname, 'fixtures', 'reference.png');

async function importViaNewReference(page: Page) {
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(FIXTURE_IMAGE);
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });
}

// Covers the multi-reference exit criterion in docs/phases/phase-7-guides-
// workspace-export.md: Wide-only tabs, each reference keeping its own state.
test.describe('at the Wide breakpoint', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('tabs open several references and keep each one independent', async ({ page }) => {
    await page.goto('/');
    await importViaNewReference(page);
    await expect(page.getByRole('tab')).toHaveCount(1);

    // Annotate reference A, then open a second reference. (The import takes
    // longer than the 400ms persist debounce, so this proves each reference
    // keeps its own state, not the flush-on-switch path specifically.)
    await page.getByRole('button', { name: 'Draw', exact: true }).click();
    const box = await page.locator('canvas').first().boundingBox();
    if (!box) throw new Error('canvas has no bounding box');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy + 50, { steps: 5 });
    await page.mouse.up();
    await expect(page.getByRole('button', { name: 'Undo last' })).toBeEnabled();

    await page.getByRole('button', { name: 'Add reference' }).click();
    await importViaNewReference(page);
    await expect(page.getByRole('tab')).toHaveCount(2);

    // Reference B is a fresh reference: no annotations.
    await page.getByRole('button', { name: 'Draw', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Undo last' })).toBeDisabled();

    // Back to A: its annotation is still there.
    await page.getByRole('tab').first().click();
    await expect(page.getByRole('tab').first()).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'Draw', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Undo last' })).toBeEnabled();

    // Closing the active tab moves to the remaining one; closing the last
    // one returns to the Projects screen.
    await page.getByRole('button', { name: /^Close / }).first().click();
    await expect(page.getByRole('tab')).toHaveCount(1);
    await page.getByRole('button', { name: /^Close / }).first().click();
    await expect(page.getByRole('tab')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'New reference' })).toBeVisible();
  });
});

test('Compact stays single-reference: no tab strip', async ({ page }) => {
  await page.goto('/');
  await importViaNewReference(page);
  await expect(page.getByRole('tablist')).toHaveCount(0);
});
