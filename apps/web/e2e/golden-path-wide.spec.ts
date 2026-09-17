import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE_IMAGE = path.join(__dirname, 'fixtures', 'reference.png');

// Wide breakpoint (>=1024px): persistent left rail + collapsible right dock,
// instead of golden-path.spec.ts's Compact bottom toolbar + bottom sheet.
test.use({ viewport: { width: 1400, height: 900 } });

test('golden path at the Wide breakpoint uses the rail/dock chrome', async ({ page }) => {
  await page.goto('/');

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(FIXTURE_IMAGE);
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });

  const dock = page.getByTestId('side-dock');

  // Dock starts collapsed: mounted (per SideDock.tsx's "always mounted so
  // the collapse itself can animate") but at zero width.
  await expect(dock).toHaveAttribute('aria-hidden', 'true');
  expect(await dock.evaluate((el) => el.getBoundingClientRect().width)).toBe(0);

  // Opening a mode expands the dock to a fixed, modest width -- never
  // competing with the canvas for space. The width change is CSS-transitioned
  // (see SideDock.tsx), so wait for it to settle before measuring.
  await page.getByRole('button', { name: 'Grid', exact: true }).click();
  await expect(dock).toHaveAttribute('aria-hidden', 'false');
  await page.waitForTimeout(300);
  const openWidth = await dock.evaluate((el) => el.getBoundingClientRect().width);
  expect(openWidth).toBeLessThanOrEqual(320);
  expect(openWidth).toBeGreaterThan(200);

  // Switching modes keeps the dock open and swaps its content.
  await page.getByRole('button', { name: 'Adjust', exact: true }).click();
  await expect(page.getByText(/Brightness \(/)).toBeVisible();

  // Closing collapses it back to zero width.
  await page.getByRole('button', { name: 'Close panel' }).click();
  await expect(dock).toHaveAttribute('aria-hidden', 'true');
  await page.waitForTimeout(300);
  expect(await dock.evaluate((el) => el.getBoundingClientRect().width)).toBe(0);

  // Export still works from the rail + dock layout.
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export image' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('reference.png');
});
