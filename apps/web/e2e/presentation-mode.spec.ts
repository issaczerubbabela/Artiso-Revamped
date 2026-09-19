import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE_IMAGE = path.join(__dirname, 'fixtures', 'reference.png');

async function importFixture(page: import('@playwright/test').Page) {
  await page.goto('/');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(FIXTURE_IMAGE);
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });
}

// Covers the presentation-mode exit criterion in docs/phases/phase-7-
// guides-workspace-export.md: a workspace display toggle over the same
// component tree (chrome hidden, gestures locked), not a separate app.
test('presentation mode hides chrome, locks gestures, and exits back to the toolbar', async ({ page }) => {
  await importFixture(page);
  await expect(page.getByRole('button', { name: 'Present' })).toBeEnabled();

  await page.getByRole('button', { name: 'Present' }).click();
  await expect(page.getByRole('button', { name: 'Exit presentation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Grid', exact: true })).toHaveCount(0);

  // Gesture lock: a wheel zoom must not change what's on screen.
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no bounding box');
  await page.waitForTimeout(300);
  const before = await page.screenshot();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(300);
  const after = await page.screenshot();
  expect(after.equals(before)).toBe(true);

  await page.getByRole('button', { name: 'Exit presentation' }).click();
  await expect(page.getByRole('button', { name: 'Import' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exit presentation' })).toHaveCount(0);

  // Control: the identical wheel input does change the view once unlocked,
  // so the equality assertion above genuinely proved the lock (not a wheel
  // that never zoomed in the first place).
  const unlockedBox = await page.locator('canvas').first().boundingBox();
  if (!unlockedBox) throw new Error('canvas has no bounding box');
  await page.waitForTimeout(300);
  const unlockedBefore = await page.screenshot();
  await page.mouse.move(unlockedBox.x + unlockedBox.width / 2, unlockedBox.y + unlockedBox.height / 2);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(300);
  const unlockedAfter = await page.screenshot();
  expect(unlockedAfter.equals(unlockedBefore)).toBe(false);
});

test.describe('at the Wide breakpoint', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('presentation mode also works with the rail/dock chrome', async ({ page }) => {
    await importFixture(page);
    await page.getByRole('button', { name: 'Present' }).click();
    await expect(page.getByRole('button', { name: 'Exit presentation' })).toBeVisible();
    await expect(page.getByTestId('side-dock')).toHaveCount(0);
    await page.getByRole('button', { name: 'Exit presentation' }).click();
    await expect(page.getByTestId('side-dock')).toHaveCount(1);
  });
});
