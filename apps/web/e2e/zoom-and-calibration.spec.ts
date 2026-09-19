import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';

const FIXTURE_IMAGE = path.join(__dirname, 'fixtures', 'reference.png');

// Fit to screen and Real size (1:1), and the one-off screen calibration behind
// it (Grid-Feature-Spec.md §10, §12).

async function importFixture(page: Page) {
  await page.goto('/');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(FIXTURE_IMAGE);
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });
  await expect(page.getByTestId('zoom-pill')).toBeVisible();
}

async function zoomIn(page: Page) {
  const box = await page.locator('canvas').first().boundingBox();
  if (!box) throw new Error('canvas has no bounding box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -600);
}

const readout = (page: Page) => page.getByTestId('zoom-readout');
const percent = async (page: Page) => Number.parseInt((await readout(page).innerText()).replace('%', ''), 10);

async function calibrate(page: Page, diagonal: string) {
  const dialog = page.getByRole('dialog', { name: 'Calibrate your screen' });
  await expect(dialog).toBeVisible();
  const field = dialog.getByLabel('Screen diagonal (inches)');
  await field.fill(diagonal);
  await field.press('Enter');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toHaveCount(0);
}

test.describe('the zoom pill', () => {
  test('starts fitted and reads 100%; zooming changes it and Fit returns to it', async ({ page }) => {
    await importFixture(page);
    await expect(readout(page)).toHaveText('100%');
    await expect(page.getByTestId('real-size-badge')).toHaveCount(0);

    await zoomIn(page);
    await expect.poll(() => percent(page)).toBeGreaterThan(100);

    await page.getByRole('button', { name: 'Fit to screen' }).click();
    await expect(readout(page)).toHaveText('100%');
  });

  test('never zooms out past fitting the whole paper', async ({ page }) => {
    await importFixture(page);
    const box = await page.locator('canvas').first().boundingBox();
    if (!box) throw new Error('canvas has no bounding box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 1500); // zoom out as far as the wheel goes
    await expect(readout(page)).toHaveText('100%');
  });

  test('is hidden while the Paper & crop tool is open, and in presentation mode', async ({ page }) => {
    await importFixture(page);
    await page.getByRole('button', { name: 'Paper', exact: true }).click();
    await expect(page.getByTestId('zoom-pill')).toHaveCount(0);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByTestId('zoom-pill')).toBeVisible();

    await page.getByRole('button', { name: 'Present' }).click();
    await expect(page.getByTestId('zoom-pill')).toHaveCount(0);
  });

  test('has no cursor readout: moving over the paper changes nothing', async ({ page }) => {
    await importFixture(page);
    const before = await page.getByTestId('zoom-pill').innerText();
    const box = await page.locator('canvas').first().boundingBox();
    if (!box) throw new Error('canvas has no bounding box');
    await page.mouse.move(box.x + box.width / 3, box.y + box.height / 3);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
    expect(await page.getByTestId('zoom-pill').innerText()).toBe(before);
  });
});

test.describe('Real size', () => {
  test('asks for a one-off calibration, then zooms to 1:1 and remembers it', async ({ page }) => {
    await importFixture(page);
    await page.getByRole('button', { name: 'Real size' }).click();

    const dialog = page.getByRole('dialog', { name: 'Calibrate your screen' });
    await expect(dialog).toBeVisible();
    // Nothing can be saved until the diagonal is known...
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
    // ...but the native resolution is already filled in from the browser.
    await expect(dialog.getByLabel('Native width')).not.toHaveValue('');
    await expect(dialog.getByLabel('Native height')).not.toHaveValue('');

    await calibrate(page, '15.6');
    // Saving carried on to what was asked for: the paper at true size.
    await expect(page.getByTestId('real-size-badge')).toHaveText('1:1');
    await expect(page.getByRole('button', { name: 'Real size' })).toHaveAttribute('aria-pressed', 'true');

    // Zooming away drops the badge; Real size brings it back without asking again.
    await zoomIn(page);
    await expect(page.getByTestId('real-size-badge')).toHaveCount(0);
    await page.getByRole('button', { name: 'Real size' }).click();
    await expect(page.getByRole('dialog', { name: 'Calibrate your screen' })).toHaveCount(0);
    await expect(page.getByTestId('real-size-badge')).toHaveText('1:1');

    await page.getByRole('button', { name: 'Fit to screen' }).click();
    await expect(page.getByTestId('real-size-badge')).toHaveCount(0);

    // The calibration survives a reload: no dialog, straight to 1:1.
    await page.reload();
    await expect(page.getByTestId('zoom-pill')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Real size' }).click();
    await expect(page.getByRole('dialog', { name: 'Calibrate your screen' })).toHaveCount(0);
    await expect(page.getByTestId('real-size-badge')).toHaveText('1:1');
  });

  test('cancelling the calibration changes nothing and does not zoom later', async ({ page }) => {
    await importFixture(page);
    await page.getByRole('button', { name: 'Real size' }).click();
    const dialog = page.getByRole('dialog', { name: 'Calibrate your screen' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('real-size-badge')).toHaveCount(0);
    await expect(readout(page)).toHaveText('100%');

    // Calibrating later, from the Paper panel, must not zoom the view unexpectedly.
    await page.getByRole('button', { name: 'Paper', exact: true }).click();
    await page.getByRole('button', { name: 'Calibrate screen for Real size' }).click();
    await calibrate(page, '15.6');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByTestId('zoom-pill')).toBeVisible();
    await expect(page.getByTestId('real-size-badge')).toHaveCount(0);
  });

  test('Escape closes the dialog without saving', async ({ page }) => {
    await importFixture(page);
    await page.getByRole('button', { name: 'Real size' }).click();
    await expect(page.getByRole('dialog', { name: 'Calibrate your screen' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Calibrate your screen' })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('artiso.display.v1'))).toBeNull();
  });

  test('shows the pixel density and a 100 mm line that follows from it', async ({ page }) => {
    await importFixture(page);
    await page.getByRole('button', { name: 'Real size' }).click();
    const dialog = page.getByRole('dialog', { name: 'Calibrate your screen' });
    await expect(dialog.getByTestId('calibration-ppi')).toHaveText('—');
    await expect(dialog.getByTestId('calibration-ruler')).toHaveCount(0);

    const field = dialog.getByLabel('Screen diagonal (inches)');
    await field.fill('13.3');
    await field.press('Enter');

    // ppi = hypot(nativeW, nativeH) / diagonal.
    const w = Number(await dialog.getByLabel('Native width').inputValue());
    const h = Number(await dialog.getByLabel('Native height').inputValue());
    const ppi = Math.hypot(w, h) / 13.3;
    await expect(dialog.getByTestId('calibration-ppi')).toHaveText(`${Math.round(ppi * 10) / 10} ppi`);

    // The ruler line is 100 mm at that density: 100 / 25.4 in * ppi, in CSS px
    // (Playwright runs at a device pixel ratio of 1).
    const ruler = await dialog.getByTestId('calibration-ruler').boundingBox();
    expect(ruler).not.toBeNull();
    expect(ruler!.width).toBeCloseTo((100 / 25.4) * ppi, 0);
  });

  test('a ruler measurement corrects the density', async ({ page }) => {
    await importFixture(page);
    await page.getByRole('button', { name: 'Real size' }).click();
    const dialog = page.getByRole('dialog', { name: 'Calibrate your screen' });
    const field = dialog.getByLabel('Screen diagonal (inches)');
    await field.fill('14');
    await field.press('Enter');
    const before = Number.parseFloat((await dialog.getByTestId('calibration-ppi').innerText()).replace(' ppi', ''));

    // The "100 mm" line measures 125 mm on a real ruler: the screen has fewer
    // pixels per inch than assumed -- 100/125 = 80% of it.
    const measured = dialog.getByLabel('Measured length (mm)');
    await measured.fill('125');
    await measured.press('Enter');
    await dialog.getByRole('button', { name: 'Correct' }).click();

    const after = Number.parseFloat((await dialog.getByTestId('calibration-ppi').innerText()).replace(' ppi', ''));
    expect(after / before).toBeCloseTo(0.8, 1);
  });

  test('the calibration stays on this device: it is not part of the reference', async ({ page }) => {
    await importFixture(page);
    await page.getByRole('button', { name: 'Real size' }).click();
    await calibrate(page, '15.6');
    await page.waitForTimeout(900);

    const stored = await page.evaluate(() => localStorage.getItem('artiso.display.v1'));
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored as string).screen).toMatchObject({ diagonalIn: 15.6 });

    const referenceJson = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('artiso');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const rows = await new Promise<unknown[]>((resolve) => {
        const query = db.transaction('references').objectStore('references').getAll();
        query.onsuccess = () => resolve(query.result);
      });
      db.close();
      return JSON.stringify(rows);
    });
    expect(referenceJson).not.toContain('diagonalIn');
    expect(referenceJson).not.toContain('nativeRes');
  });

  test('an unreadable stored calibration is ignored rather than breaking the app', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('artiso.display.v1', '{not json'));
    await importFixture(page);
    await page.getByRole('button', { name: 'Real size' }).click();
    // Treated as uncalibrated: the dialog asks again.
    await expect(page.getByRole('dialog', { name: 'Calibrate your screen' })).toBeVisible();
  });
});

test.describe('Wide breakpoint', () => {
  test.use({ viewport: { width: 1400, height: 800 } });

  async function importViaNewReference(page: Page) {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'New reference' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(FIXTURE_IMAGE);
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });
  }

  test('each pane of a split view has its own view controls, acting on its own canvas', async ({ page }) => {
    await page.goto('/');
    await importViaNewReference(page);
    await page.getByRole('button', { name: 'Add reference' }).click();
    await importViaNewReference(page);
    await page.getByRole('button', { name: /beside$/ }).click();
    const left = page.getByTestId('split-pane-left');
    const right = page.getByTestId('split-pane-right');
    await expect(left).toBeVisible();

    // One pill per pane, both fitted.
    await expect(page.getByTestId('zoom-pill')).toHaveCount(2);
    const leftReadout = left.getByTestId('zoom-readout');
    const rightReadout = right.getByTestId('zoom-readout');
    await expect(leftReadout).toHaveText('100%');
    await expect(rightReadout).toHaveText('100%');

    // Zooming the right pane changes only the right pane's pill...
    const box = await right.boundingBox();
    if (!box) throw new Error('right pane has no bounding box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -600);
    await expect.poll(async () => Number.parseInt((await rightReadout.innerText()).replace('%', ''), 10)).toBeGreaterThan(100);
    await expect(leftReadout).toHaveText('100%');

    // ...and its own Fit returns just that pane to 100%.
    await right.getByRole('button', { name: 'Fit to screen' }).click();
    await expect(rightReadout).toHaveText('100%');
  });
});
