import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE_IMAGE = path.join(__dirname, 'fixtures', 'reference.png');

// Explicit phone-sized viewport so this test deterministically exercises the
// Compact bottom-sheet chrome regardless of Playwright's own default
// viewport -- see golden-path-wide.spec.ts for the same flow at Wide.
test.use({ viewport: { width: 390, height: 844 } });

// Covers the full Phase 1 golden path (docs/phases/phase-1-web-core-mvp.md):
// Import -> Prepare (rotate) -> Grid -> Export, plus the "exit and resume a
// session without data loss" exit criterion.
test('import, edit, grid, export, and resume a session', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Artiso' })).toBeVisible();

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(FIXTURE_IMAGE);

  const canvas = page.locator('canvas').first();
  await canvas.waitFor({ state: 'visible', timeout: 15000 });

  // Grid: default config renders visibly; turning on numbering adds labels.
  await page.getByRole('button', { name: 'Grid', exact: true }).click();
  await page.getByRole('button', { name: 'numbers' }).click();
  await expect(page.getByRole('button', { name: 'Hide grid' })).toBeVisible();

  // Rotate/flip commits immediately and swaps the grid to the new dimensions.
  await page.getByRole('button', { name: 'Rotate/Flip' }).click();
  await page.getByRole('button', { name: 'Rotate 90°' }).click();

  // Crop overlay appears with its Apply/Reset/Cancel controls.
  await page.getByRole('button', { name: 'Crop', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apply crop' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  // Adjustments: brightness/contrast/saturation sliders present and live.
  await page.getByRole('button', { name: 'Adjust', exact: true }).click();
  const brightnessSlider = page.locator('input[type=range]').first();
  await brightnessSlider.fill('50');
  await expect(page.getByText('Brightness (50)')).toBeVisible();

  // Export produces a real file download. "Export image" (the panel's own
  // action button) is a distinct accessible name from the toolbar's "Export"
  // mode-switch button, so this doesn't depend on DOM order.
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export image' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('reference.png');

  // Session resume: reload with nothing but IndexedDB to go on, the edited
  // reference (rotated, gridded) comes back without re-importing.
  await page.reload();
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Artiso' })).toHaveCount(0);

  // Back to Projects shows the reference as a card; reopening it returns to
  // the workspace with the canvas visible again.
  await page.getByRole('button', { name: 'Projects' }).click();
  await expect(page.getByRole('heading', { name: 'Artiso' })).toBeVisible();
  const projectButton = page.getByTestId('project-card-open').first();
  await expect(projectButton).toBeVisible();
  await projectButton.click();
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });
});
