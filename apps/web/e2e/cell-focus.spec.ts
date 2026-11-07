import { test, expect, type Locator, type Page } from '@playwright/test';
import { screenColour, solidPng, type Rgb } from './pixels';
import { visibleCentre } from './visible-region';

// Cell Focus and Done Cells (GLOSSARY.md, issue #7). The reference is a flat
// mid-grey photo, so what Cell Focus draws is easy to read off the screen: the
// focused cell stays grey, everything else is darkened, and a Done Cell's tick
// is a bright mark on the dark.
//
// A 600 x 800 photo lands on A4 portrait (210 x 297 mm). With 70 mm cells that
// is 3 columns by 5 rows (the last row partial), 15 cells, and the paper's
// centre (105, 148.5) is in cell B3.

const GREY: Rgb = [128, 128, 128];
const GREY_PHOTO = { name: 'grey.png', mimeType: 'image/png', buffer: solidPng(600, 800, GREY) };
const WIDE = { width: 1280, height: 800 };

test.use({ viewport: WIDE });

const tool = (page: Page, name: string) => page.getByTestId('side-rail').getByRole('button', { name, exact: true });
const menu = (page: Page) => page.getByRole('menu', { name: 'Canvas' });
const bar = (scope: Page | Locator) => scope.getByTestId('cell-focus-bar');
const label = (scope: Page | Locator) => scope.getByTestId('cell-focus-label');
const count = (scope: Page | Locator) => scope.getByTestId('cell-focus-count');
const next = (page: Page) => bar(page).getByRole('button', { name: 'Next cell' });
const previous = (page: Page) => bar(page).getByRole('button', { name: 'Previous cell' });
const doneButton = (page: Page) => bar(page).getByRole('button', { name: 'Done Cell' });
const dock = (page: Page) => page.getByTestId('side-dock');

async function importGrey(page: Page) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  await (await chooser).setFiles(GREY_PHOTO);
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });
  await expect(page.getByTestId('zoom-pill').first()).toBeVisible();
}

// Opens the Grid panel and types an exact cell size (mm).
async function setCellSize(page: Page, mm: number) {
  if ((await dock(page).getAttribute('aria-hidden')) !== 'false') await tool(page, 'Grid').click();
  const field = dock(page).getByLabel('Exact cell size (mm)');
  await field.fill(String(mm));
  await field.press('Enter');
  await expect(field).toHaveValue(String(mm));
}

async function start(page: Page) {
  await page.goto('/');
  await importGrey(page);
  await setCellSize(page, 70);
  await tool(page, 'Grid').click();
  await expect(dock(page)).toHaveAttribute('aria-hidden', 'true');
}

// Brightness (mean of the channels) of the screen around a point.
async function brightness(page: Page, point: { x: number; y: number }, radius = 6): Promise<number> {
  const [r, g, b] = await screenColour(page, Math.round(point.x), Math.round(point.y), radius);
  return (r + g + b) / 3;
}

// The focused cell stays the photo's grey; the rest is darkened (70% by default).
const LIT = 100;
const DIMMED = 70;

async function expectLit(page: Page, point: { x: number; y: number }) {
  await expect.poll(() => brightness(page, point)).toBeGreaterThan(LIT);
}

async function expectDimmed(page: Page, point: { x: number; y: number }) {
  await expect.poll(() => brightness(page, point)).toBeLessThan(DIMMED);
}

// The brightest pixel (mean of channels) in a square around a point: picks out
// a thin tick that a median would ignore.
async function brightest(page: Page, point: { x: number; y: number }, radius: number): Promise<number> {
  const size = radius * 2 + 1;
  const png = await page.screenshot({ clip: { x: Math.round(point.x) - radius, y: Math.round(point.y) - radius, width: size, height: size } });
  return page.evaluate(async (b64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${b64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, image.width, image.height);
    let max = 0;
    for (let i = 0; i < data.length; i += 4) max = Math.max(max, (data[i]! + data[i + 1]! + data[i + 2]!) / 3);
    return max;
  }, png.toString('base64'));
}

// The focused (lit) cell's horizontal extent on the row through `at`: the run
// of lit pixels around that point.
async function litSpan(page: Page, at: { x: number; y: number }): Promise<{ left: number; right: number }> {
  const width = page.viewportSize()!.width;
  const png = await page.screenshot({ clip: { x: 0, y: Math.round(at.y), width, height: 1 } });
  const span = await page.evaluate(
    async ({ b64, threshold, from }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${b64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      const { data } = ctx.getImageData(0, 0, image.width, 1);
      const lit = (x: number) => x >= 0 && x < image.width && (data[x * 4]! + data[x * 4 + 1]! + data[x * 4 + 2]!) / 3 > threshold;
      if (!lit(from)) return null;
      let left = from;
      let right = from;
      while (lit(left - 1)) left--;
      while (lit(right + 1)) right++;
      return { left, right };
    },
    { b64: png.toString('base64'), threshold: LIT, from: Math.round(at.x) },
  );
  if (!span) throw new Error('no lit cell at this point');
  return span;
}

// Waits until the canvas has painted Cell Focus on `cell` ("col,row", 0-based):
// the stage publishes what it last drew, so pixels are only read after it.
async function painted(scope: Page | Locator, cell: string) {
  await expect(scope.locator(`[data-cell-focus^="${cell}:"]`)).toHaveCount(1);
}

// Right-click at the visible centre and choose "Focus this cell" (B3 here).
async function focusCentreCell(page: Page, scope: Page | Locator = page) {
  const centre = await visibleCentre(scope);
  await page.mouse.click(centre.x, centre.y, { button: 'right' });
  await menu(page).getByRole('menuitem', { name: 'Focus this cell' }).click();
  await expect(bar(page)).toBeVisible();
  await painted(scope, '1,2');
  return centre;
}

// A still touch held until the long-press fires, then lifted.
async function longPress(page: Page, point: { x: number; y: number }, until: () => Promise<void>) {
  const fire = (type: string) =>
    page.evaluate(
      ({ x, y, type }) => {
        const target = document.elementFromPoint(x, y)!;
        target.dispatchEvent(
          new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 51, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y }),
        );
      },
      { ...point, type },
    );
  await fire('pointerdown');
  try {
    await until();
  } finally {
    await fire('pointerup');
  }
}

test.describe('Cell Focus', () => {
  test('starts from the canvas menu, dims the rest and steps in grid order', async ({ page }) => {
    await start(page);
    const centre = await visibleCentre(page);
    await expect(bar(page)).toHaveCount(0);
    await expectLit(page, centre);

    await focusCentreCell(page);
    await expect(label(page)).toHaveText('B3');
    await expect(count(page)).toHaveText('0 / 15');
    // The cell under the press stays lit; the cells around it are darkened.
    await expectLit(page, centre);
    const span = await litSpan(page, centre);
    const cellPx = span.right - span.left;
    expect(cellPx).toBeGreaterThan(40);
    await expectDimmed(page, { x: span.left - cellPx / 2, y: centre.y });
    await expectDimmed(page, { x: span.right + cellPx / 2, y: centre.y });

    // Grid order: along the row, then the start of the next; wrapping round.
    const order: string[] = [];
    for (let i = 0; i < 3; i++) {
      await next(page).click();
      order.push((await label(page).textContent()) ?? '');
    }
    expect(order).toEqual(['C3', 'A4', 'B4']);
    await previous(page).click();
    await previous(page).click();
    await previous(page).click();
    await expect(label(page)).toHaveText('B3');
    // The whole sheet is in view, so stepping never moved it: B3 is dimmed
    // again once C3 is focused, at the same spot on screen.
    await next(page).click();
    await expect(label(page)).toHaveText('C3');
    await expectDimmed(page, centre);
  });

  test('the Grid panel turns it on and sets how dark the rest goes', async ({ page }) => {
    await start(page);
    await tool(page, 'Grid').click();
    const cellFocus = dock(page).getByRole('switch', { name: 'Cell Focus' });
    await expect(cellFocus).toHaveAttribute('aria-checked', 'false');
    const slider = dock(page).getByRole('slider', { name: 'Dim outside the cell' });
    await expect(slider).toHaveValue('70');

    await cellFocus.click();
    await expect(cellFocus).toHaveAttribute('aria-checked', 'true');
    // Starts in the middle of the view.
    await expect(label(page)).toHaveText('B3');
    await painted(page, '1,2');
    const centre = await visibleCentre(page);
    const span = await litSpan(page, centre);
    const beside = { x: span.left - 20, y: centre.y };
    await expect.poll(() => brightness(page, beside)).toBeLessThan(DIMMED);

    // 40% darkening: the rest is visibly lighter than at 70%.
    await slider.focus();
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowLeft');
    await expect(slider).toHaveValue('40');
    await expect.poll(() => brightness(page, beside)).toBeGreaterThan(DIMMED);
    await expect.poll(() => brightness(page, beside)).toBeLessThan(LIT);

    await cellFocus.click();
    await expect(bar(page)).toHaveCount(0);
    await expectLit(page, beside);
  });

  test('stepping to an off-screen cell pans just enough, at the same zoom', async ({ page }) => {
    await start(page);
    const centre = await visibleCentre(page);
    // Zoomed in until a cell is wider than the view.
    const readZoom = async () => Number((await page.getByTestId('zoom-readout').textContent())?.replace('%', ''));
    await page.mouse.move(centre.x, centre.y);
    await expect
      .poll(async () => {
        await page.mouse.wheel(0, -300);
        return readZoom();
      })
      .toBeGreaterThanOrEqual(500);
    // Wheel steps may still be landing: wait for the zoom to settle.
    let last = -1;
    await expect
      .poll(async () => {
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const zoom = await readZoom();
        const settled = zoom === last;
        last = zoom;
        return settled;
      })
      .toBe(true);
    const zoom = await page.getByTestId('zoom-readout').textContent();

    await focusCentreCell(page);
    await expect(label(page)).toHaveText('B3');
    await expectLit(page, centre);
    // C3 is off to the right: the view pans to it, so the middle of the screen
    // is now in the (lit) newly focused cell rather than the dimmed B3.
    await next(page).click();
    await expect(label(page)).toHaveText('C3');
    await expectLit(page, centre);
    await expect(page.getByTestId('zoom-readout')).toHaveText(zoom!);
  });

  test('grid order is the same whatever the View Rotation', async ({ page }) => {
    await start(page);
    // A quarter turn with Shift+drag about the visible centre.
    const centre = await visibleCentre(page);
    await page.keyboard.down('Shift');
    await page.mouse.move(centre.x + 150, centre.y);
    await page.mouse.down();
    for (let i = 1; i <= 18; i++) {
      const a = (i / 18) * (Math.PI / 2);
      await page.mouse.move(centre.x + 150 * Math.cos(a), centre.y + 150 * Math.sin(a));
    }
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await expect(page.getByTestId('rotation-readout')).toHaveText('90°');

    await focusCentreCell(page);
    await expect(label(page)).toHaveText('B3');
    await next(page).click();
    await expect(label(page)).toHaveText('C3');
    await next(page).click();
    await expect(label(page)).toHaveText('A4');
  });

  test('taps focus a cell only while Cell Focus is on; tapping the focused cell leaves', async ({ page }) => {
    await start(page);
    const centre = await visibleCentre(page);
    // Off: a tap does nothing cell-related.
    await page.mouse.click(centre.x, centre.y);
    await expect(bar(page)).toHaveCount(0);
    await expectLit(page, centre);

    await focusCentreCell(page);
    const span = await litSpan(page, centre);
    const cellPx = span.right - span.left;
    // A tap on the cell to the left focuses it.
    await page.mouse.click(span.left - cellPx / 2, centre.y);
    await expect(label(page)).toHaveText('A3');
    await expectDimmed(page, centre);
    // Tapping the focused cell leaves Cell Focus. (A little way from the last
    // tap, so the two are never taken for a double-tap, which is Fit.)
    await page.mouse.click(span.left - cellPx / 2, centre.y + Math.min(40, cellPx / 3));
    await expect(bar(page)).toHaveCount(0);
    await expectLit(page, centre);
  });

  test('Done Cells: ✓ and long-press mark them, a faint tick and a count show, ← → can skip them', async ({ page }) => {
    await start(page);
    const centre = await visibleCentre(page);
    await focusCentreCell(page);
    await expect(doneButton(page)).toHaveAttribute('aria-pressed', 'false');
    // B3's middle: the paper's centre is at 148.5 mm, B3's at 175 mm.
    const b3Span = await litSpan(page, centre);
    const cellPx = b3Span.right - b3Span.left;
    const b3 = { x: (b3Span.left + b3Span.right) / 2, y: centre.y + ((175 - 148.5) / 70) * cellPx };
    const tickRadius = Math.round(cellPx * 0.25);
    // No tick while B3 is not done: dimmed all over once C3 is focused.
    await next(page).click();
    await expect.poll(() => brightest(page, b3, tickRadius)).toBeLessThan(DIMMED);
    await previous(page).click();

    await doneButton(page).click();
    await expect(doneButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(count(page)).toHaveText('1 / 15');
    // B3 is done: once C3 is focused, B3 is dimmed but carries a bright tick.
    await next(page).click();
    await expect(label(page)).toHaveText('C3');
    await expectDimmed(page, centre);
    await expect.poll(() => brightest(page, b3, tickRadius)).toBeGreaterThan(LIT);
    const c3 = { x: b3Span.right + 20, y: centre.y };
    await expect(doneButton(page)).toHaveAttribute('aria-pressed', 'false');

    // A long-press on the focused cell marks it too, and again unmarks it.
    await longPress(page, c3, () => expect(count(page)).toHaveText('2 / 15'));
    await expect(doneButton(page)).toHaveAttribute('aria-pressed', 'true');
    await longPress(page, c3, () => expect(count(page)).toHaveText('1 / 15'));
    await expect(menu(page)).toHaveCount(0);
    await doneButton(page).click();
    await expect(count(page)).toHaveText('2 / 15');

    // Not skipping: ← goes back to the Done B3.
    await previous(page).click();
    await expect(label(page)).toHaveText('B3');
    await next(page).click();
    // Skipping: from C3, ← jumps over B3 to A3.
    await tool(page, 'Grid').click();
    await dock(page).getByRole('switch', { name: 'Skip Done Cells' }).click();
    await tool(page, 'Grid').click();
    await previous(page).click();
    await expect(label(page)).toHaveText('A3');
    await next(page).click();
    await expect(label(page)).toHaveText('A4');

    // ✓ unmarks too.
    await previous(page).click();
    await expect(label(page)).toHaveText('A3');
    await doneButton(page).click();
    await expect(count(page)).toHaveText('3 / 15');
    await doneButton(page).click();
    await expect(count(page)).toHaveText('2 / 15');
  });

  test('the focused cell and Done Cells are remembered on this device across a reload', async ({ page }) => {
    await start(page);
    await focusCentreCell(page);
    await doneButton(page).click();
    await next(page).click();
    await expect(label(page)).toHaveText('C3');
    await expect(count(page)).toHaveText('1 / 15');

    await page.reload();
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });
    await expect(label(page)).toHaveText('C3');
    await expect(count(page)).toHaveText('1 / 15');
  });

  test('changing the cell size clears Done Cells with an Undo; changing the style keeps them', async ({ page }) => {
    await start(page);
    await focusCentreCell(page);
    await doneButton(page).click();
    await next(page).click();
    await doneButton(page).click();
    await expect(count(page)).toHaveText('2 / 15');

    // Style: colour, line width. Nothing is cleared.
    await tool(page, 'Grid').click();
    await dock(page).getByRole('group', { name: 'Colour' }).getByRole('button', { name: '#ff3b30' }).click();
    await dock(page).getByRole('slider', { name: 'Line width' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('done-cells-notice')).toHaveCount(0);
    await expect(count(page)).toHaveText('2 / 15');

    await setCellSize(page, 50);
    const notice = page.getByTestId('done-cells-notice');
    await expect(notice).toContainText('2 Done Cells cleared');
    await expect(count(page)).toHaveText('0 / 30');

    // Undo puts the cell size back, and the Done Cells with it.
    await notice.getByRole('button', { name: 'Undo' }).click();
    await expect(dock(page).getByLabel('Exact cell size (mm)')).toHaveValue('70');
    await expect(count(page)).toHaveText('2 / 15');
    await expect(notice).toHaveCount(0);
  });

  test('changing the paper clears Done Cells too, and Undo puts the paper back', async ({ page }) => {
    await start(page);
    await focusCentreCell(page);
    await doneButton(page).click();
    await expect(count(page)).toHaveText('1 / 15');

    await tool(page, 'Paper').click();
    await page.getByLabel('Paper size').selectOption('A5');
    await page.getByRole('button', { name: 'Done' }).click();
    const notice = page.getByTestId('done-cells-notice');
    await expect(notice).toContainText('1 Done Cell cleared');
    // A5 (148 x 210 mm) holds 3 x 3 cells of 70 mm.
    await expect(count(page)).toHaveText('0 / 9');

    await notice.getByRole('button', { name: 'Undo' }).click();
    await expect(count(page)).toHaveText('1 / 15');
    await tool(page, 'Paper').click();
    await expect(page.getByLabel('Paper size')).toHaveValue('A4');
  });

  test('is greyed out, saying why, while squares are hidden', async ({ page }) => {
    await start(page);
    await focusCentreCell(page);
    await tool(page, 'Grid').click();
    await dock(page).getByRole('switch', { name: 'Squares' }).click();
    await expect(dock(page).getByRole('switch', { name: 'Cell Focus' })).toBeDisabled();
    await expect(dock(page).getByTestId('cell-focus-unavailable')).toContainText('Turn on Squares');
    await expect(bar(page)).toHaveCount(0);
    await tool(page, 'Grid').click();

    const centre = await visibleCentre(page);
    await expectLit(page, centre);
    await page.mouse.click(centre.x, centre.y, { button: 'right' });
    const item = menu(page).getByRole('menuitem', { name: /Focus this cell/ });
    await expect(item).toHaveAttribute('aria-disabled', 'true');
    await expect(item).toContainText('Turn on Squares');
    // Choosing it does nothing: the menu stays open.
    await item.click({ force: true });
    await expect(menu(page)).toBeVisible();
    await page.keyboard.press('Escape');

    // Squares back: Cell Focus picks up where it was.
    await tool(page, 'Grid').click();
    await dock(page).getByRole('switch', { name: 'Squares' }).click();
    await expect(label(page)).toHaveText('B3');
  });
});

test.describe('Cell Focus in split view', () => {
  test.use({ viewport: { width: 1400, height: 800 } });

  test('each pane has its own focus, and ← → act on the pane touched last', async ({ page }) => {
    await page.goto('/');
    await importGrey(page);
    await setCellSize(page, 70);
    await tool(page, 'Grid').click();
    await page.getByRole('button', { name: 'Add reference' }).click();
    await importGrey(page);
    await setCellSize(page, 70);
    await tool(page, 'Grid').click();
    await page.getByRole('button', { name: /beside$/ }).click();
    const left = page.getByTestId('split-pane-left');
    const right = page.getByTestId('split-pane-right');
    await expect(left).toHaveAttribute('data-focused', 'true');

    // Left pane: B3, stepped on to C3.
    await focusCentreCell(page, left);
    await expect(label(left)).toHaveText('B3');
    await next(page).click();
    await expect(label(left)).toHaveText('C3');

    // Touching the right pane makes it the one the buttons act on. Its own
    // focus is off; the left keeps its focus (and its dim) while parked.
    const rightCentre = await visibleCentre(right);
    await page.mouse.click(rightCentre.x, rightCentre.y);
    await expect(right).toHaveAttribute('data-focused', 'true');
    await expect(bar(page)).toHaveCount(0);
    await expectDimmed(page, await visibleCentre(left));

    await focusCentreCell(page, right);
    await expect(bar(page)).toHaveCount(1);
    await expect(label(right)).toHaveText('B3');
    await previous(page).click();
    await expect(label(right)).toHaveText('A3');

    // Back to the left: its focus is untouched, and → now steps it.
    const leftCentre = await visibleCentre(left);
    await page.mouse.click(leftCentre.x, leftCentre.y);
    await expect(left).toHaveAttribute('data-focused', 'true');
    await expect(label(left)).toHaveText('C3');
    await next(page).click();
    await expect(label(left)).toHaveText('A4');
    // The right pane, parked, still shows its own focused cell (A3) lit.
    await expectDimmed(page, rightCentre);
  });
});
