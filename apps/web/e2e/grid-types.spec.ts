import path from 'node:path';
import { test, expect } from '@playwright/test';

const FIXTURE_IMAGE = path.join(__dirname, 'fixtures', 'reference.png');

// The Guides layer (docs/phases/phase-9-drawing-grid-overhaul.md): perspective,
// rule-of-thirds and golden-ratio guides survive the drawing-grid overhaul as an
// optional layer drawn beneath the grid. Each must be selectable and render
// without the renderer needing type-specific handling
// (.agents/workflows/add-new-grid-type-recipe.md's Verification step).
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

  // No guide until one is added; the grid itself is untouched by the guides.
  await expect(page.getByRole('button', { name: 'Remove guide' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add a guide' }).click();
  await expect(page.getByRole('button', { name: 'Remove guide' })).toBeVisible();

  for (const label of ['Thirds', 'Golden ratio', 'Perspective']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(canvas).toBeVisible();
    // A crash in geometry generation or the renderer would throw inside the
    // rAF loop and never repaint -- the guide's visibility switch is a cheap way
    // to force a redraw and confirm the app is still alive after switching.
    const show = page.getByRole('switch', { name: 'Show guide' });
    await show.click();
    await show.click();
    await expect(show).toHaveAttribute('aria-checked', 'true');
  }

  // Perspective-only control: switching to 3 vanishing points reveals the
  // third-point-position selector (conditionally rendered).
  await page.getByRole('button', { name: 'Perspective', exact: true }).click();
  await page.getByRole('group', { name: 'Vanishing points' }).getByRole('button', { name: '3', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Third point' })).toBeVisible();

  // Golden-ratio-only control.
  await page.getByRole('button', { name: 'Golden ratio', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Orientation' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Third point' })).toHaveCount(0);

  // The old rows x cols and radial-rings guide types are gone from the picker.
  await expect(page.getByRole('button', { name: 'Rectangular', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Radial', exact: true })).toHaveCount(0);
  // The grid's own controls are still there, unchanged.
  await expect(page.getByRole('switch', { name: 'Squares' })).toHaveAttribute('aria-checked', 'true');
});

// The guide is a composition over the grid, not a replacement for it: it can be
// added, configured independently and removed without disturbing the grid.
test('a guide can be added, configured, and removed without touching the grid', async ({ page }) => {
  await page.goto('/');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(FIXTURE_IMAGE);

  const canvas = page.locator('canvas').first();
  await canvas.waitFor({ state: 'visible', timeout: 15000 });
  await page.getByRole('button', { name: 'Grid', exact: true }).click();

  // Turn the grid's diagonals on first, so we can tell the guide leaves them alone.
  await page.getByRole('switch', { name: 'Diagonals' }).click();

  await expect(page.getByRole('button', { name: 'Add a guide' })).toBeVisible();
  await page.getByRole('button', { name: 'Add a guide' }).click();
  await page.getByRole('button', { name: 'Perspective', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Show guide' })).toBeVisible();
  await expect(canvas).toBeVisible();

  await expect(page.getByRole('switch', { name: 'Diagonals' })).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('button', { name: 'Remove guide' }).click();
  await expect(page.getByRole('button', { name: 'Add a guide' })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Show guide' })).toHaveCount(0);
  await expect(page.getByRole('switch', { name: 'Diagonals' })).toHaveAttribute('aria-checked', 'true');
});
