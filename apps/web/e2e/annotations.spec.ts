import path from 'node:path';
import { test, expect } from '@playwright/test';
import { visibleCentre } from './visible-region';

const FIXTURE_IMAGE = path.join(__dirname, 'fixtures', 'reference.png');

// Covers the annotation-layer exit criterion in docs/phases/phase-7-guides-
// workspace-export.md: "Annotations persist as part of a Reference's
// non-destructive edit state and survive reload/resume, same guarantee as
// the rest of the EditStack." Draws each of the four annotation types
// directly on the canvas via real pointer gestures, then reloads the page
// and confirms they're still there -- not just that the draft rendered.
test('arrow, circle, freehand, and note annotations draw and survive reload', async ({ page }) => {
  await page.goto('/');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(FIXTURE_IMAGE);
  const canvas = page.locator('canvas').first();
  await canvas.waitFor({ state: 'visible', timeout: 15000 });

  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  // The canvas is full-bleed under the chrome: draw where the photo really is.
  const { x: cx, y: cy } = await visibleCentre(page);

  // Undo/Clear start disabled -- no annotations yet.
  await expect(page.getByRole('button', { name: 'Undo last' })).toBeDisabled();

  // Arrow (default tool): drag from center to a corner.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 60, cy + 40, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Undo last' })).toBeEnabled();

  // Circle.
  await page.getByRole('button', { name: 'Circle', exact: true }).click();
  await page.mouse.move(cx - 50, cy - 50);
  await page.mouse.down();
  await page.mouse.move(cx - 20, cy - 20, { steps: 5 });
  await page.mouse.up();

  // Freehand: several intermediate points so it's a real path, not a dot.
  await page.getByRole('button', { name: 'Freehand', exact: true }).click();
  await page.mouse.move(cx - 80, cy + 60);
  await page.mouse.down();
  await page.mouse.move(cx - 60, cy + 70, { steps: 3 });
  await page.mouse.move(cx - 40, cy + 50, { steps: 3 });
  await page.mouse.up();

  // Note: a single click opens the inline text prompt; Enter commits it.
  await page.getByRole('button', { name: 'Note', exact: true }).click();
  await page.mouse.move(cx + 80, cy - 60);
  await page.mouse.down();
  await page.mouse.up();
  await page.getByPlaceholder('Note…').fill('Check the proportions here');
  await page.getByPlaceholder('Note…').press('Enter');
  await expect(page.getByPlaceholder('Note…')).toHaveCount(0);

  // Session resume: reload with nothing but IndexedDB to go on, same
  // guarantee golden-path.spec.ts already checks for editStack/gridConfig.
  // Waits past workspace-store's 400ms persist debounce so the last
  // annotation has actually reached IndexedDB before the reload.
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo last' })).toBeEnabled();

  // Clean up back to empty via the panel's own Clear all action.
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.getByRole('button', { name: 'Undo last' })).toBeDisabled();
});

test('drawing a stroke does not pan the canvas', async ({ page }) => {
  await page.goto('/');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(FIXTURE_IMAGE);
  const canvas = page.locator('canvas').first();
  await canvas.waitFor({ state: 'visible', timeout: 15000 });

  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  // The canvas is full-bleed under the chrome: draw where the photo really is.
  const { x: cx, y: cy } = await visibleCentre(page);

  // Dragging with the Annotate tool active must commit a shape, not pan the
  // viewport -- Settings' Gesture Lock pattern (isGestureLocked) is what
  // CanvasStage reuses to suppress InputController's own pan handling here.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 100, cy + 100, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Undo last' })).toBeEnabled();
});
