import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { visibleCentre } from './visible-region';
import { colourDistance, screenColour, solidPng, type Rgb } from './pixels';

const FIXTURE_IMAGE = path.join(__dirname, 'fixtures', 'reference.png');

// Two "photos of the drawing", solid colours nothing in the reference comes
// close to, so what is on screen says plainly which one is showing.
const BLUE: Rgb = [20, 60, 230];
const RED: Rgb = [230, 30, 40];
const BLUE_PHOTO = { name: 'check-blue.png', mimeType: 'image/png', buffer: solidPng(600, 800, BLUE) };
const RED_PHOTO = { name: 'check-red.png', mimeType: 'image/png', buffer: solidPng(600, 800, RED) };

// JPEG re-encoding and blending shift a colour a little; a different colour is
// far away.
const SAME = 40;

async function importReference(page: Page): Promise<void> {
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  await (await chooser).setFiles(FIXTURE_IMAGE);
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });
}

async function takePhoto(page: Page, file: typeof BLUE_PHOTO, label: RegExp): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: label }).click();
  await (await chooser).setFiles(file);
  await expect(page.getByRole('dialog', { name: 'Line up the Check Photo' })).toBeVisible({ timeout: 15000 });
}

// Taps the paper's four corners -- deliberately out of order -- around the
// middle of the photo, holding the last one to check the loupe.
async function placeCorners(page: Page): Promise<void> {
  const stage = page.getByTestId('check-aligner-stage');
  const box = await stage.boundingBox();
  if (!box) throw new Error('aligner stage has no bounding box');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const instruction = page.getByTestId('check-aligner-instruction');

  await expect(instruction).toHaveText(/corner 1 of 4/);
  await page.mouse.click(cx + 90, cy + 120); // bottom-right
  await expect(instruction).toHaveText(/corner 2 of 4/);
  await page.mouse.click(cx - 90, cy - 120); // top-left
  await page.mouse.click(cx + 90, cy - 120); // top-right
  await expect(page.getByRole('button', { name: 'Done' })).toBeDisabled();

  // The loupe shows only while a finger (here, the mouse) is down.
  await page.mouse.move(cx - 90, cy + 120);
  await page.mouse.down();
  await expect(page.getByTestId('check-loupe')).toBeVisible();
  await page.mouse.move(cx - 95, cy + 125, { steps: 3 });
  await page.mouse.up();
  await expect(page.getByTestId('check-loupe')).toHaveCount(0);

  await expect(instruction).toHaveText(/Drag a corner/);
  await expect(page.getByRole('button', { name: /^Corner \d$/ })).toHaveCount(4);
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('dialog', { name: 'Line up the Check Photo' })).toHaveCount(0);
}

test.describe('Drawing Check', () => {
  test('a Check Photo is lined up by its corners, blended over the reference, swapped by holding, replaced and deleted', async ({ page }) => {
    // The whole Drawing Check in one go, with two reloads: longer than most.
    test.setTimeout(120_000);
    await importReference(page);
    await page.getByRole('button', { name: 'Drawing Check', exact: true }).click();
    const { x, y } = await visibleCentre(page);
    const reference = await screenColour(page, x, y);
    expect(colourDistance(reference, BLUE)).toBeGreaterThan(80);
    expect(colourDistance(reference, RED)).toBeGreaterThan(80);

    // Cancelling the first corner placement saves nothing.
    await takePhoto(page, BLUE_PHOTO, /^Take Check Photo$/);
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: 'Take Check Photo' })).toBeVisible();
    await expect(page.getByRole('slider', { name: 'Check Photo opacity' })).toHaveCount(0);

    await takePhoto(page, BLUE_PHOTO, /^Take Check Photo$/);
    await placeCorners(page);

    // Opacity blends the photo over the reference: none, half, all of it.
    const opacity = page.getByRole('slider', { name: 'Check Photo opacity' });
    await opacity.fill('100');
    await expect.poll(async () => colourDistance(await screenColour(page, x, y), BLUE)).toBeLessThan(SAME);
    await opacity.fill('0');
    await expect.poll(async () => colourDistance(await screenColour(page, x, y), reference)).toBeLessThan(SAME);
    await opacity.fill('50');
    await expect
      .poll(async () => {
        const half = await screenColour(page, x, y);
        return colourDistance(half, reference) > SAME && colourDistance(half, BLUE) > SAME;
      })
      .toBe(true);

    // Press and hold shows only the photo, whatever the opacity; release returns.
    await opacity.fill('0');
    const hold = page.getByRole('button', { name: 'Hold to show only the photo' });
    const holdBox = await hold.boundingBox();
    if (!holdBox) throw new Error('hold button has no bounding box');
    await page.mouse.move(holdBox.x + holdBox.width / 2, holdBox.y + holdBox.height / 2);
    await page.mouse.down();
    await expect.poll(async () => colourDistance(await screenColour(page, x, y), BLUE)).toBeLessThan(SAME);
    await page.mouse.up();
    await expect.poll(async () => colourDistance(await screenColour(page, x, y), reference)).toBeLessThan(SAME);

    // The keyboard can hold it too.
    await hold.focus();
    await page.keyboard.down('Space');
    await expect.poll(async () => colourDistance(await screenColour(page, x, y), BLUE)).toBeLessThan(SAME);
    await page.keyboard.up('Space');
    await expect.poll(async () => colourDistance(await screenColour(page, x, y), reference)).toBeLessThan(SAME);

    // The corners can be adjusted later, without retaking the photo.
    await page.getByRole('button', { name: 'Adjust corners' }).click();
    await expect(page.getByRole('button', { name: /^Corner \d$/ })).toHaveCount(4);
    await page.getByRole('button', { name: 'Corner 1' }).focus();
    await page.keyboard.press('Shift+ArrowLeft');
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('dialog', { name: 'Line up the Check Photo' })).toHaveCount(0);

    // A new photo replaces the old one.
    await opacity.fill('100');
    await takePhoto(page, RED_PHOTO, /^Retake Check Photo$/);
    await placeCorners(page);
    await expect.poll(async () => colourDistance(await screenColour(page, x, y), RED)).toBeLessThan(SAME);

    // It is kept on this device across a reload, and never became part of the
    // reference's own edits.
    await page.reload();
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });
    await page.getByRole('button', { name: 'Drawing Check', exact: true }).click();
    await page.getByRole('slider', { name: 'Check Photo opacity' }).fill('100');
    await expect.poll(async () => colourDistance(await screenColour(page, x, y), RED)).toBeLessThan(SAME);

    // Deleting it leaves the reference exactly as it was.
    await page.getByRole('button', { name: 'Delete Check Photo' }).click();
    await expect(page.getByRole('button', { name: 'Take Check Photo' })).toBeVisible();
    await expect.poll(async () => colourDistance(await screenColour(page, x, y), reference)).toBeLessThan(SAME);
    await page.reload();
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });
    await page.getByRole('button', { name: 'Drawing Check', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Take Check Photo' })).toBeVisible();
  });

  test('corners can be placed without touch, at the photo edges', async ({ page }) => {
    await importReference(page);
    await page.getByRole('button', { name: 'Drawing Check', exact: true }).click();
    await takePhoto(page, BLUE_PHOTO, /^Take Check Photo$/);
    await page.getByRole('button', { name: 'Use photo edges' }).click();
    await expect(page.getByRole('button', { name: /^Corner \d$/ })).toHaveCount(4);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('slider', { name: 'Check Photo opacity' })).toBeVisible();
  });
});

test.describe('Drawing Check at the Wide breakpoint', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the Check Photo shows over the reference with the dock open', async ({ page }) => {
    await importReference(page);
    await page.getByRole('button', { name: 'Drawing Check', exact: true }).click();
    const { x, y } = await visibleCentre(page);
    await takePhoto(page, BLUE_PHOTO, /^Take Check Photo$/);
    await placeCorners(page);
    await page.getByRole('slider', { name: 'Check Photo opacity' }).fill('100');
    await expect.poll(async () => colourDistance(await screenColour(page, x, y), BLUE)).toBeLessThan(SAME);
  });
});
