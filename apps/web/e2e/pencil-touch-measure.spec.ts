import { test, expect, type Page } from '@playwright/test';
import { colourDistance, screenColour, solidPng, type Rgb } from './pixels';
import { visibleCentre } from './visible-region';

// Pencil, touch and Measure (issue #8): Touch Lock, Pencil-only Drawing,
// Pencil pressure and hover, the touch shortcuts and Measurement. Pencil and
// finger input is dispatched as synthetic Pointer Events (pointerType 'pen' /
// 'touch', with pressure and hover), since Playwright has neither a stylus nor
// multi-touch.
//
// A 600 x 800 grey photo lands on A4 portrait (210 x 297 mm). With 20 mm cells
// that is 11 columns by 15 rows, and the paper's centre (105, 148.5) is in F8.

const GREY: Rgb = [128, 128, 128];
const GREY_PHOTO = { name: 'grey.png', mimeType: 'image/png', buffer: solidPng(600, 800, GREY) };

test.use({ viewport: { width: 1280, height: 800 } });

const tool = (page: Page, name: string) => page.getByTestId('side-rail').getByRole('button', { name, exact: true });
const dock = (page: Page) => page.getByTestId('side-dock');
const stage = (page: Page) => page.locator('[data-view-rotation]').first();
const zoomReadout = (page: Page) => page.getByTestId('zoom-readout');
const touchLock = (page: Page) => page.getByTestId('zoom-pill').getByRole('button', { name: 'Touch Lock' });
const menu = (page: Page) => page.getByRole('menu', { name: 'Canvas' });
const undo = (page: Page) => page.getByRole('button', { name: 'Undo last' });
const pencilOnlySwitch = (page: Page) => page.getByRole('switch', { name: 'Pencil-only Drawing' });
const readout = (page: Page) => page.getByTestId('measure-readout');

async function start(page: Page) {
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  await (await chooser).setFiles(GREY_PHOTO);
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });
  await expect(page.getByTestId('zoom-pill')).toBeVisible();
  await tool(page, 'Grid').click();
  const field = dock(page).getByLabel('Exact cell size (mm)');
  await field.fill('20');
  await field.press('Enter');
  await expect(field).toHaveValue('20');
  await tool(page, 'Grid').click();
  await expect(dock(page)).toHaveAttribute('aria-hidden', 'true');
}

interface PointerInit {
  pointerId: number;
  pointerType: 'touch' | 'pen';
  x: number;
  y: number;
  pressure?: number;
  buttons?: number;
}

// Dispatches pointer events, in order, on whatever is under each point.
async function fire(page: Page, events: (PointerInit & { type: string })[]) {
  await page.evaluate((list) => {
    for (const e of list) {
      const target = document.elementFromPoint(e.x, e.y);
      if (!target) throw new Error(`nothing at ${e.x},${e.y}`);
      const down = e.type === 'pointerdown' || e.type === 'pointermove';
      target.dispatchEvent(
        new PointerEvent(e.type, {
          bubbles: true,
          cancelable: true,
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          isPrimary: true,
          clientX: e.x,
          clientY: e.y,
          pressure: e.pressure ?? (e.type === 'pointerup' ? 0 : 0.5),
          buttons: e.buttons ?? (down ? 1 : 0),
        }),
      );
    }
  }, events);
}

// A drag from `from` by (dx, dy) in small steps, then lifted.
async function drag(
  page: Page,
  pointerType: 'touch' | 'pen',
  from: { x: number; y: number },
  dx: number,
  dy: number,
  options: { pointerId?: number; pressure?: number } = {},
) {
  const pointerId = options.pointerId ?? (pointerType === 'pen' ? 71 : 61);
  const steps = 10;
  const events: (PointerInit & { type: string })[] = [
    { type: 'pointerdown', pointerId, pointerType, x: from.x, y: from.y, pressure: options.pressure },
  ];
  for (let i = 1; i <= steps; i++) {
    events.push({ type: 'pointermove', pointerId, pointerType, x: from.x + (dx * i) / steps, y: from.y + (dy * i) / steps, pressure: options.pressure });
  }
  events.push({ type: 'pointerup', pointerId, pointerType, x: from.x + dx, y: from.y + dy });
  await fire(page, events);
}

// A Pencil hovering over a point with nothing pressed.
async function hover(page: Page, point: { x: number; y: number }) {
  await fire(page, [{ type: 'pointermove', pointerId: 81, pointerType: 'pen', x: point.x, y: point.y, buttons: 0, pressure: 0 }]);
}

// The cell label the Pencil hover shows at a point.
async function hoveredCell(page: Page, point: { x: number; y: number }): Promise<string> {
  await hover(page, point);
  await expect(stage(page)).toHaveAttribute('data-pencil-hover', /.+/);
  return (await stage(page).getAttribute('data-pencil-hover')) ?? '';
}

// Fingers landing together at `points` and lifting at once.
async function fingerTap(page: Page, points: { x: number; y: number }[]) {
  const events: (PointerInit & { type: string })[] = [];
  points.forEach((p, i) => events.push({ type: 'pointerdown', pointerId: 91 + i, pointerType: 'touch', ...p }));
  points.forEach((p, i) => events.push({ type: 'pointerup', pointerId: 91 + i, pointerType: 'touch', ...p }));
  await fire(page, events);
}

// Two fingers 100px apart about `centre`, spread to 300px apart.
async function pinchOut(page: Page, centre: { x: number; y: number }) {
  const events: (PointerInit & { type: string })[] = [
    { type: 'pointerdown', pointerId: 11, pointerType: 'touch', x: centre.x - 50, y: centre.y },
    { type: 'pointerdown', pointerId: 12, pointerType: 'touch', x: centre.x + 50, y: centre.y },
  ];
  for (let i = 1; i <= 10; i++) {
    events.push({ type: 'pointermove', pointerId: 11, pointerType: 'touch', x: centre.x - 50 - i * 10, y: centre.y });
    events.push({ type: 'pointermove', pointerId: 12, pointerType: 'touch', x: centre.x + 50 + i * 10, y: centre.y });
  }
  events.push({ type: 'pointerup', pointerId: 11, pointerType: 'touch', x: centre.x - 150, y: centre.y });
  events.push({ type: 'pointerup', pointerId: 12, pointerType: 'touch', x: centre.x + 150, y: centre.y });
  await fire(page, events);
}

// Zooms in about `centre` with the wheel, so a pan has room to move the view
// (at Fit the whole sheet is in view and a pan barely moves it).
async function zoomIn(page: Page, centre: { x: number; y: number }) {
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.wheel(0, -600);
  await expect(zoomReadout(page)).not.toHaveText('100%');
}

// Two quick finger taps at one point, in one go so they land within the
// double-tap window whatever the machine's load.
async function doubleTap(page: Page, point: { x: number; y: number }) {
  const events: (PointerInit & { type: string })[] = [];
  for (const pointerId of [95, 96]) {
    events.push({ type: 'pointerdown', pointerId, pointerType: 'touch', ...point });
    events.push({ type: 'pointerup', pointerId, pointerType: 'touch', ...point });
  }
  await fire(page, events);
}

async function openDraw(page: Page, drawTool: string) {
  await tool(page, 'Draw').click();
  await page.getByRole('button', { name: drawTool, exact: true }).click();
}

test.describe('Touch Lock', () => {
  test('freezes the view while Cell Focus controls and Pencil hover keep working', async ({ page }) => {
    await start(page);
    const centre = await visibleCentre(page);
    await zoomIn(page, centre);
    await expect(await hoveredCell(page, centre)).toBe('F8');

    // Cell Focus on the centre cell, from the canvas menu.
    await page.mouse.click(centre.x, centre.y, { button: 'right' });
    await menu(page).getByRole('menuitem', { name: 'Focus this cell' }).click();
    const label = page.getByTestId('cell-focus-label');
    await expect(label).toHaveText('F8');

    await touchLock(page).click();
    await expect(touchLock(page)).toHaveAttribute('aria-pressed', 'true');
    // Not Presentation mode: the chrome stays and nothing re-fits.
    await expect(page.getByTestId('side-rail')).toBeVisible();
    await expect(page.getByTestId('zoom-pill').getByRole('button', { name: 'Fit to screen' })).toBeDisabled();

    // A finger pan, a pinch and a double-tap do nothing; the Pencil hover
    // still reads F8.
    const zoom = (await zoomReadout(page).textContent()) ?? '';
    await drag(page, 'touch', centre, 0, 150);
    await pinchOut(page, centre);
    await doubleTap(page, centre);
    await expect(zoomReadout(page)).toHaveText(zoom);
    await expect(await hoveredCell(page, centre)).toBe('F8');

    // A Pencil tap on another cell is ignored (it would focus that cell).
    const right = { x: centre.x + 120, y: centre.y };
    await fire(page, [
      { type: 'pointerdown', pointerId: 72, pointerType: 'pen', ...right },
      { type: 'pointerup', pointerId: 72, pointerType: 'pen', ...right },
    ]);
    // ← → and ✓ still work.
    const bar = page.getByTestId('cell-focus-bar');
    await bar.getByRole('button', { name: 'Next cell' }).click();
    await expect(label).toHaveText('G8');
    await bar.getByRole('button', { name: 'Done Cell' }).click();
    await expect(page.getByTestId('cell-focus-count')).toHaveText('1 / 165');

    // The canvas menu can't unlock it.
    await page.mouse.click(centre.x, centre.y, { button: 'right' });
    await expect(menu(page).getByRole('menuitem', { name: /Touch Lock/ })).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');

    // A quick press does not unlock; a one-second press does.
    const box = (await touchLock(page).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(touchLock(page)).toHaveAttribute('data-holding', 'true');
    await page.mouse.up();
    await expect(touchLock(page)).not.toHaveAttribute('data-holding', 'true');
    await expect(touchLock(page)).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.down();
    await expect(touchLock(page)).toHaveAttribute('aria-pressed', 'false', { timeout: 5000 });
    await page.mouse.up();
    // The click that ends the hold does not lock it again.
    await expect(touchLock(page)).toHaveAttribute('aria-pressed', 'false');

    // Unlocked, the same finger pan moves the view.
    await drag(page, 'touch', centre, 0, 150);
    await expect.poll(() => hoveredCell(page, centre)).not.toBe('F8');
  });

  test('locks from the canvas menu', async ({ page }) => {
    await start(page);
    const centre = await visibleCentre(page);
    await page.mouse.click(centre.x, centre.y, { button: 'right' });
    await menu(page).getByRole('menuitem', { name: 'Touch Lock' }).click();
    await expect(touchLock(page)).toHaveAttribute('aria-pressed', 'true');
    await pinchOut(page, centre);
    await expect(zoomReadout(page)).toHaveText('100%');
  });
});

test.describe('Pencil-only Drawing', () => {
  test('turns on at the first Pencil stroke; then fingers pan and never draw', async ({ page }) => {
    await start(page);
    const centre = await visibleCentre(page);
    await zoomIn(page, centre);
    await openDraw(page, 'Freehand');
    const from = { x: centre.x - 60, y: centre.y + 40 };

    // Without a Pencil, a finger draws as it always has.
    await expect(pencilOnlySwitch(page)).toHaveCount(0);
    await drag(page, 'touch', from, 80, 20);
    await expect(undo(page)).toBeEnabled();
    await undo(page).click();
    await expect(undo(page)).toBeDisabled();

    // The first Pencil stroke draws and switches Pencil-only Drawing on.
    await drag(page, 'pen', from, 80, 20);
    await expect(undo(page)).toBeEnabled();
    await expect(pencilOnlySwitch(page)).toHaveAttribute('aria-checked', 'true');
    await undo(page).click();
    await expect(undo(page)).toBeDisabled();

    // Now a finger moves the view instead of drawing.
    const before = await hoveredCell(page, centre);
    await drag(page, 'touch', centre, 0, 150);
    await expect.poll(() => hoveredCell(page, centre)).not.toBe(before);
    await expect(undo(page)).toBeDisabled();

    // A palm resting beside a Pencil stroke neither draws nor stops it.
    await fire(page, [{ type: 'pointerdown', pointerId: 65, pointerType: 'touch', x: centre.x + 100, y: centre.y + 100 }]);
    await drag(page, 'pen', from, 80, 20);
    await fire(page, [{ type: 'pointerup', pointerId: 65, pointerType: 'touch', x: centre.x + 100, y: centre.y + 100 }]);
    await expect(undo(page)).toBeEnabled();
    await undo(page).click();

    // Switched off, fingers draw again -- and the choice is remembered.
    await pencilOnlySwitch(page).click();
    await expect(pencilOnlySwitch(page)).toHaveAttribute('aria-checked', 'false');
    await drag(page, 'touch', from, 80, 20);
    await expect(undo(page)).toBeEnabled();

    await page.reload();
    await expect(page.getByTestId('zoom-pill')).toBeVisible({ timeout: 15000 });
    await tool(page, 'Draw').click();
    await expect(pencilOnlySwitch(page)).toHaveAttribute('aria-checked', 'false');
  });
});

// How many pixels in a 1px-wide column through `x` (from y0 to y1) are far from
// the grey photo: the thickness of a horizontal stroke crossing it.
async function inkedPixels(page: Page, x: number, y0: number, y1: number): Promise<number> {
  const png = await page.screenshot({ clip: { x: Math.round(x), y: Math.round(y0), width: 1, height: Math.round(y1 - y0) } });
  return page.evaluate(
    async ({ b64, grey }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${b64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      const { data } = ctx.getImageData(0, 0, image.width, image.height);
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const d = Math.hypot(data[i]! - grey[0], data[i + 1]! - grey[1], data[i + 2]! - grey[2]);
        if (d > 60) count++;
      }
      return count;
    },
    { b64: png.toString('base64'), grey: GREY },
  );
}

test('Pencil pressure changes the line width', async ({ page }) => {
  await start(page);
  const centre = await visibleCentre(page);
  // The grid off, so only the strokes are inked.
  await page.mouse.click(centre.x, centre.y, { button: 'right' });
  await menu(page).getByRole('menuitem', { name: 'Hide grid' }).click();
  await openDraw(page, 'Freehand');
  await page.getByRole('button', { name: 'thick', exact: true }).click();

  const light = { x: centre.x - 100, y: centre.y - 60 };
  const hard = { x: centre.x - 100, y: centre.y + 60 };
  await drag(page, 'pen', light, 200, 0, { pressure: 0.1 });
  await drag(page, 'pen', hard, 200, 0, { pressure: 1 });

  const at = centre.x;
  await expect.poll(() => inkedPixels(page, at, light.y - 20, light.y + 20)).toBeGreaterThan(0);
  await expect.poll(() => inkedPixels(page, at, hard.y - 20, hard.y + 20)).toBeGreaterThan(0);
  const thin = await inkedPixels(page, at, light.y - 20, light.y + 20);
  const thick = await inkedPixels(page, at, hard.y - 20, hard.y + 20);
  expect(thick).toBeGreaterThanOrEqual(thin * 2.5);
});

test('Pencil hover shows the cell under the tip, in every mode, and goes when it leaves', async ({ page }) => {
  await start(page);
  const centre = await visibleCentre(page);
  await hover(page, centre);
  await expect(stage(page)).toHaveAttribute('data-pencil-hover', 'F8');
  // The label chip is drawn up and right of the tip (dark matte on the grey).
  await expect
    .poll(async () => colourDistance(await screenColour(page, Math.round(centre.x + 34), Math.round(centre.y - 30), 2), GREY))
    .toBeGreaterThan(60);

  // Far enough left to be in another cell, it follows the tip.
  await hover(page, { x: centre.x - 150, y: centre.y });
  await expect(stage(page)).not.toHaveAttribute('data-pencil-hover', 'F8');
  await expect(stage(page)).toHaveAttribute('data-pencil-hover', /^[A-E]8$/);

  await fire(page, [{ type: 'pointerleave', pointerId: 81, pointerType: 'pen', ...centre, buttons: 0 }]);
  await expect(stage(page)).not.toHaveAttribute('data-pencil-hover', /.*/);
  await expect
    .poll(async () => colourDistance(await screenColour(page, Math.round(centre.x + 34), Math.round(centre.y - 30), 2), GREY))
    .toBeLessThan(30);

  // In the Draw tool too.
  await openDraw(page, 'Arrow');
  await hover(page, centre);
  await expect(stage(page)).toHaveAttribute('data-pencil-hover', 'F8');
});

test.describe('touch shortcuts', () => {
  test('two-finger tap undoes in Draw, three-finger tap toggles the grid, double-tap fits', async ({ page }) => {
    await start(page);
    const centre = await visibleCentre(page);

    // Three fingers hide the grid, three more show it.
    await fingerTap(page, [centre, { x: centre.x + 60, y: centre.y }, { x: centre.x + 120, y: centre.y }]);
    await page.mouse.click(centre.x, centre.y, { button: 'right' });
    await expect(menu(page).getByRole('menuitem', { name: 'Show grid' })).toBeVisible();
    await page.keyboard.press('Escape');
    await fingerTap(page, [centre, { x: centre.x + 60, y: centre.y }, { x: centre.x + 120, y: centre.y }]);
    await page.mouse.click(centre.x, centre.y, { button: 'right' });
    await expect(menu(page).getByRole('menuitem', { name: 'Hide grid' })).toBeVisible();
    await page.keyboard.press('Escape');

    // Double-tap fits: zoom in, then two quick taps.
    await zoomIn(page, centre);
    await doubleTap(page, centre);
    await expect(zoomReadout(page)).toHaveText('100%');

    // Two fingers undo the last mark in Draw.
    await openDraw(page, 'Arrow');
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.mouse.move(centre.x + 60, centre.y + 40, { steps: 5 });
    await page.mouse.up();
    await expect(undo(page)).toBeEnabled();
    await fingerTap(page, [centre, { x: centre.x + 80, y: centre.y }]);
    await expect(undo(page)).toBeDisabled();
  });
});

test.describe('Measure', () => {
  async function measure(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + dx, from.y + dy, { steps: 6 });
    await page.mouse.up();
  }

  const parse = (text: string) => {
    const match = /^([\d.]+) (mm|cm|in|px) · ([\d.]+) cells?$/.exec(text);
    if (!match) throw new Error(`not a measurement: ${text}`);
    return { length: Number(match[1]), unit: match[2], cells: Number(match[3]) };
  };

  test('reads paper units and cells, snaps on hold and is never kept', async ({ page }) => {
    await start(page);
    const centre = await visibleCentre(page);
    await openDraw(page, 'Measure');
    await expect(readout(page)).toContainText('Drag across the reference');

    const from = { x: centre.x - 100, y: centre.y };
    await measure(page, from, 200, 0);
    await expect(readout(page)).toHaveText(/ mm · /);
    const flat = parse((await readout(page).textContent()) ?? '');
    // 20 mm cells: the cell count is the length over 20.
    expect(flat.length).toBeGreaterThan(40);
    expect(Math.abs(flat.cells - flat.length / 20)).toBeLessThanOrEqual(0.06);
    await expect(stage(page)).toHaveAttribute('data-measurement', `${flat.length} mm · ${flat.cells} ${flat.cells === 1 ? 'cell' : 'cells'}`);
    // Nothing is added to the drawing.
    await expect(undo(page)).toBeDisabled();

    // A slanted drag without holding reads longer; held at the end it snaps
    // onto the horizontal and reads the flat length again.
    await measure(page, from, 200, 60);
    const slanted = parse((await readout(page).textContent()) ?? '');
    expect(slanted.length).toBeGreaterThan(flat.length);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 200, from.y + 60, { steps: 6 });
    await expect(readout(page)).toHaveText(`${flat.length} mm · ${flat.cells} ${flat.cells === 1 ? 'cell' : 'cells'}`, { timeout: 5000 });
    await page.mouse.up();

    // The paper unit setting: centimetres.
    await tool(page, 'Paper').click();
    await page.getByLabel('Units').selectOption('cm');
    await tool(page, 'Paper').click();
    await openDraw(page, 'Measure');
    // Leaving Measure took the Measurement with it.
    await expect(readout(page)).toContainText('Drag across the reference');
    await expect(stage(page)).not.toHaveAttribute('data-measurement', /.*/);
    await measure(page, from, 200, 0);
    await expect(readout(page)).toHaveText(/ cm · /);
    const inCm = parse((await readout(page).textContent()) ?? '');
    expect(Math.abs(inCm.length - flat.length / 10)).toBeLessThanOrEqual(0.02);

    // Never saved: gone after a reload.
    await page.reload();
    await expect(page.getByTestId('zoom-pill')).toBeVisible({ timeout: 15000 });
    await expect(stage(page)).not.toHaveAttribute('data-measurement', /.*/);
  });
});
