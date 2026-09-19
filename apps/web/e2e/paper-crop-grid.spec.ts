import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { visibleCentre } from './visible-region';

const FIXTURE_IMAGE = path.join(__dirname, 'fixtures', 'reference.png'); // 640 x 480

// Covers the drawing-grid overhaul's paper, crop and grid settings
// (docs/phases/phase-9-drawing-grid-overhaul.md, Grid-Feature-Spec.md §12) end
// to end: what the artist does in the panels, and what is persisted for it.

async function importFixture(page: Page) {
  await page.goto('/');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(FIXTURE_IMAGE);
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });
}

interface StoredReference {
  paper: { preset: string; orientation: string; widthMm: number; heightMm: number } | null;
  crop: { x: number; y: number; w: number; h: number } | null;
  gridSettings: {
    cellMm: number;
    showSquares: boolean;
    showDiagonals: boolean;
    showRadial: boolean;
    radialStepDeg: number;
    labels: { enabled: boolean; columns: string; rows: string };
    style: { color: string; widthPx: number; opacity: number };
    marginMm: number;
  } | null;
  editStack: Array<{ type: string; degrees?: number }>;
}

async function readReference(page: Page): Promise<StoredReference> {
  const rows = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('artiso');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const all = await new Promise<unknown[]>((resolve) => {
      const query = db.transaction('references').objectStore('references').getAll();
      query.onsuccess = () => resolve(query.result);
    });
    db.close();
    return all;
  });
  return rows[0] as StoredReference;
}

// Persisting is debounced (400ms), so wait for it to land before reading.
async function settled(page: Page) {
  await page.waitForTimeout(900);
}

test.describe('a fresh import', () => {
  test('starts framed on A4 with the grid already set up', async ({ page }) => {
    await importFixture(page);
    const reference = await readReference(page);

    // A wide photo starts on A4 turned to landscape, with the largest centred crop.
    expect(reference.paper).toEqual({ preset: 'A4', orientation: 'landscape', widthMm: 297, heightMm: 210 });
    expect(reference.crop).not.toBeNull();
    const crop = reference.crop!;
    expect(crop.w / crop.h).toBeCloseTo(297 / 210, 6);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.w).toBeLessThanOrEqual(640 + 1e-6);
    expect(crop.y + crop.h).toBeLessThanOrEqual(480 + 1e-6);
    // Squares and labels on; diagonals and radial off; one shared style.
    expect(reference.gridSettings).toMatchObject({
      showSquares: true,
      showDiagonals: false,
      showRadial: false,
      labels: { enabled: true },
      marginMm: 0,
    });
    // Nothing is baked into the EditStack: crop is not an operation any more.
    expect(reference.editStack.some((op) => op.type === 'crop')).toBe(false);
  });
});

test.describe('Paper & crop', () => {
  test('turning the paper reframes the crop and is saved when the tool is left', async ({ page }) => {
    await importFixture(page);
    await page.getByRole('button', { name: 'Paper', exact: true }).click();
    await expect(page.getByLabel('Paper size')).toHaveValue('A4');
    await expect(page.getByRole('button', { name: 'Landscape' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Portrait' }).click();
    await expect(page.getByRole('button', { name: 'Portrait' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Done' }).click();
    await settled(page);

    const reference = await readReference(page);
    expect(reference.paper).toMatchObject({ preset: 'A4', orientation: 'portrait', widthMm: 210, heightMm: 297 });
    // The crop is always the shape of the paper, and stays inside the photo.
    const crop = reference.crop!;
    expect(crop.w / crop.h).toBeCloseTo(210 / 297, 6);
    expect(crop.x + crop.w).toBeLessThanOrEqual(640 + 1e-6);
    expect(crop.y + crop.h).toBeLessThanOrEqual(480 + 1e-6);
  });

  test('leaving the tool with the toolbar saves it too, and Reset framing re-centres the crop', async ({ page }) => {
    await importFixture(page);
    await page.getByRole('button', { name: 'Paper', exact: true }).click();
    await page.getByLabel('Paper size').selectOption('A5');
    await page.getByRole('button', { name: 'Reset framing' }).click();
    // Toggling the tool button closes it (no Done needed).
    await page.getByRole('button', { name: 'Paper', exact: true }).click();
    await settled(page);

    const reference = await readReference(page);
    expect(reference.paper).toMatchObject({ preset: 'A5', orientation: 'landscape', widthMm: 210, heightMm: 148 });
    const crop = reference.crop!;
    expect(crop.w / crop.h).toBeCloseTo(210 / 148, 6);
    // Reset centres it.
    expect(crop.x + crop.w / 2).toBeCloseTo(320, 3);
    expect(crop.y + crop.h / 2).toBeCloseTo(240, 3);
  });

  test('a custom paper takes width and height in the chosen unit', async ({ page }) => {
    await importFixture(page);
    await page.getByRole('button', { name: 'Paper', exact: true }).click();
    await page.getByLabel('Paper size').selectOption('custom');

    const width = page.getByLabel('Width');
    const height = page.getByLabel('Height');
    await width.fill('20');
    await width.press('Enter');
    await height.fill('30');
    await height.press('Enter');
    // Entered in millimetres (the default unit): a 20 x 30 mm sheet. Switching the
    // display unit to centimetres re-reads the same size as 2 x 3 cm.
    await page.getByLabel('Units').selectOption('cm');
    await expect(width).toHaveValue('2');
    await expect(height).toHaveValue('3');
    await page.getByRole('button', { name: 'Done' }).click();
    await settled(page);

    const reference = await readReference(page);
    expect(reference.paper).toMatchObject({ preset: 'custom', orientation: 'portrait', widthMm: 20, heightMm: 30 });
    expect(reference.crop!.w / reference.crop!.h).toBeCloseTo(20 / 30, 6);
  });

  test('an invalid size is flagged and never applied', async ({ page }) => {
    await importFixture(page);
    await page.getByRole('button', { name: 'Paper', exact: true }).click();
    await page.getByLabel('Paper size').selectOption('custom');

    const width = page.getByLabel('Width');
    await width.fill('abc');
    await expect(width).toHaveAttribute('aria-invalid', 'true');
    await width.press('Enter');
    // It reverts to the last good value rather than applying nonsense.
    await expect(width).toHaveValue('297');
    await width.fill('-5');
    await width.press('Enter');
    await expect(width).toHaveValue('297');
  });

  test('choosing pixels explains DPI, and the explanation goes away for other units', async ({ page }) => {
    await importFixture(page);
    await page.getByRole('button', { name: 'Paper', exact: true }).click();

    await expect(page.getByText(/Pixels aren't a physical size/)).toHaveCount(0);
    await page.getByLabel('Units').selectOption('px');
    // The spec's wording, verbatim.
    await expect(
      page.getByText(
        "Pixels aren't a physical size. DPI (dots per inch) tells the app how many pixels equal one inch of paper. At 300 DPI, 300 px = 1 inch. A higher DPI gives a smaller physical size for the same pixels. If unsure, leave it at 300.",
      ),
    ).toBeVisible();
    await expect(page.getByLabel('DPI')).toHaveValue('300');

    await page.getByLabel('Units').selectOption('mm');
    await expect(page.getByText(/Pixels aren't a physical size/)).toHaveCount(0);
  });

  test('pixels are converted through the DPI', async ({ page }) => {
    await importFixture(page);
    await page.getByRole('button', { name: 'Paper', exact: true }).click();
    await page.getByLabel('Paper size').selectOption('custom');
    await page.getByLabel('Units').selectOption('px');

    // 300 px at 300 dpi is one inch.
    const width = page.getByLabel('Width');
    await width.fill('300');
    await width.press('Enter');
    await page.getByRole('button', { name: 'Done' }).click();
    await settled(page);
    expect((await readReference(page)).paper!.widthMm).toBeCloseTo(25.4, 6);
  });

  test('rotating the photo turns the paper with it', async ({ page }) => {
    await importFixture(page);
    await page.getByRole('button', { name: 'Rotate/Flip' }).click();
    await page.getByRole('button', { name: 'Rotate 90°' }).click();
    await settled(page);

    const reference = await readReference(page);
    expect(reference.editStack).toContainEqual({ type: 'rotate', degrees: 90 });
    // The picture keeps the shape of its frame: a quarter turn swaps the paper.
    expect(reference.paper).toMatchObject({ preset: 'A4', orientation: 'portrait', widthMm: 210, heightMm: 297 });
    expect(reference.crop!.w / reference.crop!.h).toBeCloseTo(210 / 297, 6);
    // ...and the crop now lives in the rotated 480 x 640 image.
    expect(reference.crop!.x + reference.crop!.w).toBeLessThanOrEqual(480 + 1e-6);
    expect(reference.crop!.y + reference.crop!.h).toBeLessThanOrEqual(640 + 1e-6);
  });

  test('panning the photo under the frame moves the crop without resizing the frame', async ({ page }) => {
    await importFixture(page);
    await page.getByRole('button', { name: 'Paper', exact: true }).click();
    // Portrait paper on a landscape photo leaves horizontal room to pan.
    await page.getByRole('button', { name: 'Portrait' }).click();
    await page.waitForTimeout(400);
    // Drag from the middle of what is actually visible, not of the full-bleed canvas.
    const { x: cx, y: cy } = await visibleCentre(page);

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx - 80, cy, { steps: 8 });
    await page.mouse.up();
    await page.getByRole('button', { name: 'Done' }).click();
    await settled(page);

    const reference = await readReference(page);
    const crop = reference.crop!;
    // Dragging the photo left shows more of its right side: the crop moved right of centre...
    expect(crop.x + crop.w / 2).toBeGreaterThan(320);
    // ...but is still the paper's shape and inside the photo.
    expect(crop.w / crop.h).toBeCloseTo(210 / 297, 6);
    expect(crop.x + crop.w).toBeLessThanOrEqual(640 + 1e-6);
  });
});

test.describe('Grid settings', () => {
  async function openGrid(page: Page) {
    await importFixture(page);
    await page.getByRole('button', { name: 'Grid', exact: true }).click();
  }

  test('each overlay has its own switch and every change is saved', async ({ page }) => {
    await openGrid(page);
    await page.getByRole('switch', { name: 'Diagonals' }).click();
    await page.getByRole('switch', { name: 'Radial' }).click();
    await expect(page.getByLabel('Radial step')).toBeVisible();
    await settled(page);

    const { gridSettings } = await readReference(page);
    expect(gridSettings).toMatchObject({ showSquares: true, showDiagonals: true, showRadial: true, radialStepDeg: 15 });
  });

  test('the cell size is set in the chosen unit and stored in millimetres', async ({ page }) => {
    await openGrid(page);
    const exact = page.getByLabel(/Exact cell size/);
    await exact.fill('40');
    await exact.press('Enter');
    await settled(page);
    expect((await readReference(page)).gridSettings!.cellMm).toBe(40);

    // The same value read back in centimetres.
    await page.getByRole('button', { name: 'Paper', exact: true }).click();
    await page.getByLabel('Units').selectOption('cm');
    await page.getByRole('button', { name: 'Grid', exact: true }).click();
    await expect(page.getByLabel(/Exact cell size/)).toHaveValue('4');
  });

  test('rejects a cell size of zero or less', async ({ page }) => {
    await openGrid(page);
    const exact = page.getByLabel(/Exact cell size/);
    await exact.fill('0');
    await expect(exact).toHaveAttribute('aria-invalid', 'true');
    await exact.press('Enter');
    await expect(exact).toHaveValue('25'); // reverted
    await settled(page);
    expect((await readReference(page)).gridSettings!.cellMm).toBe(25);
  });

  test('columns and rows choose numbers or letters independently', async ({ page }) => {
    await openGrid(page);
    // Default: columns lettered, rows numbered ("C4").
    await expect(page.getByRole('group', { name: 'Columns' }).getByRole('button', { name: 'Letters' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('group', { name: 'Columns' }).getByRole('button', { name: 'Numbers' }).click();
    await page.getByRole('group', { name: 'Rows' }).getByRole('button', { name: 'Letters' }).click();
    await settled(page);

    expect((await readReference(page)).gridSettings!.labels).toMatchObject({
      enabled: true,
      columns: 'numbers',
      rows: 'letters',
    });
  });

  test('labels can be switched off, hiding their scheme controls', async ({ page }) => {
    await openGrid(page);
    await page.getByRole('switch', { name: 'Labels' }).click();
    await expect(page.getByRole('group', { name: 'Columns' })).toHaveCount(0);
    await settled(page);
    expect((await readReference(page)).gridSettings!.labels.enabled).toBe(false);
  });

  test('one shared style: colour, line width and opacity', async ({ page }) => {
    await openGrid(page);
    await page.getByRole('button', { name: '#ff3b30' }).click();
    await page.getByLabel('Line width').fill('3');
    await page.getByLabel('Opacity', { exact: true }).fill('50');
    await settled(page);

    expect((await readReference(page)).gridSettings!.style).toEqual({ color: '#ff3b30', widthPx: 3, opacity: 0.5 });
  });

  test('hiding the squares hides their cell controls', async ({ page }) => {
    await openGrid(page);
    await page.getByRole('switch', { name: 'Squares' }).click();
    await expect(page.getByLabel('Cell size', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('switch', { name: 'Labels' })).toHaveCount(0);
  });

  test('there is no live cursor readout anywhere', async ({ page }) => {
    await openGrid(page);
    await page.getByRole('button', { name: 'Grid', exact: true }).click(); // close the panel
    const canvas = await page.locator('canvas').first().boundingBox();
    if (!canvas) throw new Error('canvas has no bounding box');
    const before = await page.locator('body').innerText();
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.mouse.move(canvas.x + canvas.width / 2 + 40, canvas.y + canvas.height / 2 + 30, { steps: 5 });
    // Moving over the paper changes nothing on the page: no "square under cursor" text.
    expect(await page.locator('body').innerText()).toBe(before);
  });
});
