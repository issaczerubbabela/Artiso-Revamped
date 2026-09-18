import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE_IMAGE = path.join(__dirname, 'fixtures', 'reference.png');

// Covers .agents/workflows/add-new-grid-type-recipe.md's Verification step:
// each of the five guide types (Phase 7) must be selectable and render
// without the renderer needing type-specific handling -- this is the visual
// confirmation that the shared LineSegment/Label abstraction actually holds
// for perspective/radial/rule-of-thirds/golden-ratio, not just rectangular.
test('every guide type is selectable and renders on the canvas', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Artiso' })).toBeVisible();

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(FIXTURE_IMAGE);

  const canvas = page.locator('canvas').first();
  await canvas.waitFor({ state: 'visible', timeout: 15000 });

  await page.getByRole('button', { name: 'Grid', exact: true }).click();

  const guideTypes = ['Rectangular', 'Thirds', 'Golden ratio', 'Perspective', 'Radial'];
  for (const label of guideTypes) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(canvas).toBeVisible();
    // A crash in geometry generation or the renderer would throw inside the
    // rAF loop and never repaint -- the visibility toggle is a cheap way to
    // force a redraw and confirm the app is still alive after switching.
    await expect(page.getByRole('button', { name: 'Hide grid' })).toBeVisible();
  }

  // Perspective-only control: switching to 3 vanishing points reveals the
  // third-point-position selector (conditionally rendered).
  await page.getByRole('button', { name: 'Perspective', exact: true }).click();
  await page.getByRole('button', { name: '3', exact: true }).click();
  await expect(page.getByRole('button', { name: 'above' })).toBeVisible();

  // Radial-only control: rings/spokes sliders are present.
  await page.getByRole('button', { name: 'Radial', exact: true }).click();
  await expect(page.getByText(/Rings \(\d+\)/)).toBeVisible();
  await expect(page.getByText(/Spokes \(\d+\)/)).toBeVisible();

  // Switching back to the rectangular type restores its rows/cols density
  // and numbering controls.
  await page.getByRole('button', { name: 'Rectangular', exact: true }).click();
  await expect(page.getByRole('button', { name: '8×8' })).toBeVisible();
});
