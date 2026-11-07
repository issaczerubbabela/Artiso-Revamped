import { test, expect, type Page } from '@playwright/test';
import { solidPng, type Rgb } from './pixels';
import { visibleCentre } from './visible-region';

// Keyboard shortcuts, the Gestures & shortcuts card and the first-run gesture
// hint (issue #11). Each shortcut is checked by what it visibly changes: the
// grid's ink, the zoom and angle readouts, the immersive chrome, the focused
// cell's label and the Draw panel's Undo. ⌘ or Ctrl is chosen by the platform
// the page says it is on (Playwright's WebKit reports a Mac even on Windows),
// which is what the app itself goes by.
//
// A 600 x 800 grey photo lands on A4 portrait. With 20 mm cells that is 11
// columns by 15 rows, and the visible centre is in F8.

const GREY: Rgb = [128, 128, 128];
const GREY_PHOTO = { name: 'grey.png', mimeType: 'image/png', buffer: solidPng(600, 800, GREY) };

test.use({ viewport: { width: 1280, height: 800 } });

const tool = (page: Page, name: string) => page.getByTestId('side-rail').getByRole('button', { name, exact: true });
const dock = (page: Page) => page.getByTestId('side-dock');
const menu = (page: Page) => page.getByRole('menu', { name: 'Canvas' });
const card = (page: Page) => page.getByRole('dialog', { name: 'Gestures & shortcuts' });
const hint = (page: Page) => page.getByTestId('gesture-hint');
const zoomReadout = (page: Page) => page.getByTestId('zoom-readout');
const angle = (page: Page) => page.getByTestId('rotation-readout');
const cellLabel = (page: Page) => page.getByTestId('cell-focus-label');
const pane = (page: Page) => page.getByTestId('pane').first();

// ⌘ on Apple platforms, Ctrl elsewhere -- as the app decides it.
const primaryKey = async (page: Page) =>
  (await page.locator('html').getAttribute('data-platform')) === 'apple' ? 'Meta' : 'Control';

// Pixels with any ink on the grid layer: zero when the grid is off the canvas.
const gridInk = (page: Page) =>
  page.locator('canvas[data-layer="grid"]').first().evaluate((canvas: HTMLCanvasElement) => {
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    let inked = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) inked++;
    return inked;
  });

async function importGrey(page: Page) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  await (await chooser).setFiles(GREY_PHOTO);
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });
  await expect(page.getByTestId('zoom-pill')).toBeVisible();
}

async function start(page: Page) {
  await page.goto('/');
  await importGrey(page);
  await tool(page, 'Grid').click();
  const field = dock(page).getByLabel('Exact cell size (mm)');
  await field.fill('20');
  await field.press('Enter');
  await expect(field).toHaveValue('20');
  await tool(page, 'Grid').click();
  await expect(dock(page)).toHaveAttribute('aria-hidden', 'true');
  // Keys go to the canvas, as after a tap on it.
  await pane(page).focus();
  await expect.poll(() => gridInk(page)).toBeGreaterThan(0);
}

async function zoomIn(page: Page) {
  const { x, y } = await visibleCentre(page);
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, -400);
  await expect(zoomReadout(page)).not.toHaveText('100%');
}

// About 45° with Shift+drag about the visible centre: clear of the right-angle snap.
async function turn(page: Page) {
  const centre = await visibleCentre(page);
  await page.keyboard.down('Shift');
  await page.mouse.move(centre.x + 150, centre.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    const a = (i / 10) * (Math.PI / 4);
    await page.mouse.move(centre.x + 150 * Math.cos(a), centre.y + 150 * Math.sin(a));
  }
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(angle(page)).toBeVisible();
  await pane(page).focus();
}

test.describe('keyboard shortcuts', () => {
  test('G shows and hides the grid', async ({ page }) => {
    await start(page);
    await page.keyboard.press('g');
    await expect.poll(() => gridInk(page)).toBe(0);
    await page.keyboard.press('G');
    await expect.poll(() => gridInk(page)).toBeGreaterThan(0);
  });

  test('holding Space hides the grid until released, without changing the saved setting', async ({ page }) => {
    await start(page);
    await page.keyboard.down('Space');
    await expect.poll(() => gridInk(page)).toBe(0);
    await page.keyboard.up('Space');
    await expect.poll(() => gridInk(page)).toBeGreaterThan(0);

    // The grid hidden with G stays hidden through a Space-hold, and the canvas
    // menu still offers to show it: the setting itself never moved.
    await page.keyboard.press('g');
    await expect.poll(() => gridInk(page)).toBe(0);
    await page.keyboard.down('Space');
    await page.keyboard.up('Space');
    await pane(page).press('Shift+F10');
    await expect(menu(page).getByRole('menuitem', { name: 'Show grid' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect.poll(() => gridInk(page)).toBe(0);
  });

  test('0 fits and R squares up the view', async ({ page }) => {
    await start(page);
    await zoomIn(page);
    await pane(page).focus();
    await page.keyboard.press('0');
    await expect(zoomReadout(page)).toHaveText('100%');

    await turn(page);
    await page.keyboard.press('r');
    await expect(angle(page)).toHaveCount(0);
  });

  test('F turns immersive mode on and off', async ({ page }) => {
    await start(page);
    await page.keyboard.press('f');
    await expect(page.getByRole('button', { name: 'Exit presentation' })).toBeVisible();
    await expect(page.getByTestId('side-rail')).toHaveCount(0);
    await page.keyboard.press('f');
    await expect(page.getByRole('button', { name: 'Exit presentation' })).toHaveCount(0);
    await expect(page.getByTestId('side-rail')).toBeVisible();
  });

  test('← and → step through the cells while Cell Focus is on', async ({ page }) => {
    await start(page);
    // Off: the arrows do nothing cell-related.
    await page.keyboard.press('ArrowRight');
    await expect(cellLabel(page)).toHaveCount(0);

    const { x, y } = await visibleCentre(page);
    await page.mouse.click(x, y, { button: 'right' });
    await menu(page).getByRole('menuitem', { name: 'Focus this cell' }).click();
    await expect(cellLabel(page)).toHaveText('F8');
    await pane(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect(cellLabel(page)).toHaveText('G8');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(cellLabel(page)).toHaveText('E8');
  });

  test('⌘Z (Ctrl+Z) undoes the last mark in Draw', async ({ page }) => {
    await start(page);
    await tool(page, 'Draw').click();
    const undo = page.getByRole('button', { name: 'Undo last' });
    await expect(undo).toBeDisabled();
    const { x, y } = await visibleCentre(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y + 40, { steps: 5 });
    await page.mouse.up();
    await expect(undo).toBeEnabled();
    await page.keyboard.press(`${await primaryKey(page)}+z`);
    await expect(undo).toBeDisabled();
  });

  test('are ignored while typing in a number field', async ({ page }) => {
    await start(page);
    await zoomIn(page);
    await tool(page, 'Grid').click();
    const field = dock(page).getByLabel('Exact cell size (mm)');
    await field.focus();
    await page.keyboard.press('g');
    await page.keyboard.press('f');
    await page.keyboard.press('0');
    await page.keyboard.down('Space');
    await page.keyboard.up('Space');
    // None of them acted: the grid is drawn, the chrome is up, the zoom held.
    await expect(page.getByRole('button', { name: 'Exit presentation' })).toHaveCount(0);
    await expect(zoomReadout(page)).not.toHaveText('100%');
    await expect(card(page)).toHaveCount(0);
    await page.keyboard.press('?');
    await expect(card(page)).toHaveCount(0);
    expect(await gridInk(page)).toBeGreaterThan(0);
    // Control: the same key off the field does act.
    await field.press('Escape');
    await pane(page).focus();
    await page.keyboard.press('g');
    await expect.poll(() => gridInk(page)).toBe(0);
  });
});

test.describe('the Gestures & shortcuts card', () => {
  test('opens from the canvas menu and lists every gesture and shortcut', async ({ page }) => {
    await start(page);
    await pane(page).press('Shift+F10');
    await menu(page).getByRole('menuitem', { name: 'Gestures & shortcuts' }).click();
    await expect(card(page)).toBeVisible();
    const apple = (await page.locator('html').getAttribute('data-platform')) === 'apple';
    const keys = page.getByTestId('shortcuts-card-keys');
    for (const key of ['G', 'F', '0', 'R', '←', '→', 'Hold Space', apple ? '⌘Z' : 'Ctrl+Z', apple ? '⌘V' : 'Ctrl+V']) {
      await expect(keys.getByText(key, { exact: true })).toBeVisible();
    }
    await expect(card(page).getByText('Two-finger tap', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(card(page)).toHaveCount(0);
  });

  // That a quick press or a chord is not a hold is unit-tested with a fake
  // clock (ModifierHoldDetector); proving a negative here would need a sleep.
  test('opens with ? and when ⌘ (Ctrl) is held', async ({ page }) => {
    await start(page);
    await page.keyboard.press('?');
    await expect(card(page)).toBeVisible();
    await page.keyboard.press('?');
    await expect(card(page)).toHaveCount(0);

    const modifier = await primaryKey(page);
    await page.keyboard.down(modifier);
    await expect(card(page)).toBeVisible();
    await page.keyboard.up(modifier);
    await card(page).getByRole('button', { name: 'Close' }).click();
    await expect(card(page)).toHaveCount(0);
  });
});

test.describe('the first-run gesture hint', () => {
  test('shows on the empty canvas once, and never again after it is dismissed', async ({ page }) => {
    await page.goto('/');
    await expect(hint(page)).toBeVisible();
    await hint(page).getByRole('button', { name: 'Gestures & shortcuts' }).click();
    await expect(card(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(hint(page)).toBeVisible();
    await hint(page).getByRole('button', { name: 'Dismiss hint' }).click();
    await expect(hint(page)).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'New reference' })).toBeVisible();
    await expect(page.getByText('No references yet', { exact: false })).toBeVisible();
    await expect(hint(page)).toHaveCount(0);
  });

  test('never shows again once a reference has been imported', async ({ page }) => {
    await page.goto('/');
    await expect(hint(page)).toBeVisible();
    await importGrey(page);
    // Back to an empty Projects screen: the reference is deleted again.
    await tool(page, 'Projects').click();
    page.on('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('No references yet', { exact: false })).toBeVisible();
    await expect(hint(page)).toHaveCount(0);
  });
});
