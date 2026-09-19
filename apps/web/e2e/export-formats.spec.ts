import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const FIXTURE_IMAGE = path.join(__dirname, 'fixtures', 'reference.png');

// Covers the two Export checklist items in docs/phases/phase-7-guides-
// workspace-export.md's exit criteria: "SVG and PDF export produce
// correctly-configured output for a representative reference, verified by
// inspection (structure/content), not just 'a file was produced'".
test('SVG export produces a grid-only vector document', async ({ page }) => {
  await page.goto('/');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(FIXTURE_IMAGE);
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: 'SVG (grid only)' }).click();

  // The image/adjustments/grid toggles don't apply to a grid-only vector
  // format -- confirm they're hidden rather than just ignored, so the UI
  // doesn't lie about what SVG export includes.
  await expect(page.getByRole('button', { name: 'Include image' })).toHaveCount(0);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export image' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('reference.svg');

  const filePath = await download.path();
  expect(filePath).not.toBeNull();
  const content = await readFile(filePath as string, 'utf-8');
  expect(content).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
  // Sized in real millimetres (A4 landscape, the default for a wide photo) so it
  // prints at physical scale, with the squares as one batched path.
  expect(content).toMatch(/width="297mm" height="210mm" viewBox="0 0 297 210"/);
  expect(content).toContain('<path id="squares"');
  expect(content).not.toContain('<image');
});

test('PDF export produces a single-page PDF with the composited image embedded', async ({ page }) => {
  await page.goto('/');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(FIXTURE_IMAGE);
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: 'PDF', exact: true }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export image' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('reference.pdf');

  const filePath = await download.path();
  expect(filePath).not.toBeNull();
  const buffer = await readFile(filePath as string);
  expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(buffer.toString('latin1')).toContain('/Image');
});
