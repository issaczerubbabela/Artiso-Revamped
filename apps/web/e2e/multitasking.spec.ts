import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { visibleCentre } from './visible-region';

const FIXTURE_IMAGE = path.join(__dirname, 'fixtures', 'reference.png');

// Multitasking on iPad (issue #10): Split View, Slide Over and Stage Manager
// windows get the Compact or Regular chrome by window width, a resize keeps the
// artist's place, and landscape and portrait each remember their own view.

async function importFixture(page: Page) {
  await page.goto('/');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  await (await fileChooserPromise).setFiles(FIXTURE_IMAGE);
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });
  await expect(page.getByTestId('zoom-pill')).toBeVisible();
}

const zoomReadout = (page: Page) => page.getByTestId('zoom-readout');
const angle = (page: Page) => page.getByTestId('rotation-readout');

// Nothing on the page is wider than the window: no sideways scrolling.
async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
    .toBeLessThanOrEqual(0);
}

async function expectWithinWindow(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`${testId} has no bounding box`);
  const width = page.viewportSize()!.width;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
}

// iPad Air 11" in landscape is 1180×820: Slide Over is 320 wide, and Split
// View gives the app 507 (⅓ … ½) or 694 (½ … ⅔). Stage Manager windows can be
// any of these. At 820 (⅔, or portrait full screen) it is Regular.
const COMPACT_WIDTHS = [320, 507, 694];

test.describe('narrow windows', () => {
  for (const width of COMPACT_WIDTHS) {
    test(`a ${width}px window shows the Compact chrome`, async ({ page }) => {
      await page.setViewportSize({ width, height: 820 });
      await importFixture(page);
      await expect(page.getByTestId('bottom-toolbar')).toBeVisible();
      await expect(page.getByTestId('side-rail')).toHaveCount(0);
      await expectWithinWindow(page, 'bottom-toolbar');
      await expectWithinWindow(page, 'zoom-pill');
      await expectNoHorizontalOverflow(page);
      // A large panel opens as the bottom sheet, within the window.
      await page.getByTestId('bottom-toolbar').getByRole('button', { name: 'Grid', exact: true }).click();
      await expect(page.getByTestId('bottom-sheet')).toBeVisible();
      await expectWithinWindow(page, 'bottom-sheet');
      await expectNoHorizontalOverflow(page);
    });
  }

  test('an 820px window shows the Regular chrome', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 820 });
    await importFixture(page);
    await expect(page.getByTestId('side-rail')).toBeVisible();
    await expect(page.getByTestId('bottom-toolbar')).toHaveCount(0);
    // Tabs are Wide-only.
    await expect(page.getByTestId('tab-strip')).toHaveCount(0);
    await expectWithinWindow(page, 'zoom-pill');
    await expectNoHorizontalOverflow(page);
    await page.getByTestId('side-rail').getByRole('button', { name: 'Grid', exact: true }).click();
    await expect(page.getByTestId('bottom-sheet')).toBeVisible();
    await expectWithinWindow(page, 'bottom-sheet');
  });
});

// Whether the annotation layer has paint within a few px of a point. Read from
// the canvas itself (Canvas2D), not a screenshot.
async function annotationPaintedAt(page: Page, point: { x: number; y: number }): Promise<boolean> {
  return page.evaluate(({ x, y }) => {
    const canvas = document.querySelector('canvas[data-layer="annotation"]') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const ratio = canvas.width / rect.width;
    const data = canvas
      .getContext('2d')!
      .getImageData(Math.round((x - rect.left) * ratio) - 3, Math.round((y - rect.top) * ratio) - 3, 7, 7).data;
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) return true;
    return false;
  }, point);
}

test.describe('resizing the window', () => {
  test('a fitted reference re-fits in what the chrome leaves free', async ({ page }) => {
    await page.setViewportSize({ width: 694, height: 820 });
    await importFixture(page);
    await expect(zoomReadout(page)).toHaveText('100%');
    for (const width of [507, 320, 820, 694]) {
      await page.setViewportSize({ width, height: 820 });
      await expect(zoomReadout(page)).toHaveText('100%');
    }
  });

  test('a zoomed-in view keeps its place across window sizes and breakpoints', async ({ page }) => {
    // Regular, where the Draw panel is a popover that covers no part of the view.
    await page.setViewportSize({ width: 820, height: 820 });
    await importFixture(page);
    const centre = await visibleCentre(page);
    await page.mouse.move(centre.x + 40, centre.y - 30);
    for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -200);
    await expect.poll(async () => Number.parseInt((await zoomReadout(page).innerText()).replace('%', ''), 10)).toBeGreaterThan(150);

    // Mark the place: a short stroke across the middle of the view.
    await page.getByTestId('side-rail').getByRole('button', { name: 'Draw', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Draw' })).toBeVisible();
    const mark = await visibleCentre(page);
    await page.mouse.move(mark.x - 12, mark.y);
    await page.mouse.down();
    await page.mouse.move(mark.x + 12, mark.y, { steps: 6 });
    await page.mouse.up();
    await expect.poll(() => annotationPaintedAt(page, mark)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Draw' })).toHaveCount(0);

    // Slide Over and Split View sizes, back to Regular: the mark stays in the
    // middle of what is visible, whatever the chrome covers.
    for (const width of [694, 507, 320, 820]) {
      await page.setViewportSize({ width, height: 820 });
      await expect.poll(async () => annotationPaintedAt(page, await visibleCentre(page))).toBe(true);
      // Still zoomed in: the window size never resets the view.
      expect(Number.parseInt((await zoomReadout(page).innerText()).replace('%', ''), 10)).toBeGreaterThan(100);
    }
  });
});

// Two fingers 160px apart about the visible centre, twisted by `degrees` and
// spread by `spread`, then lifted (synthetic touch Pointer Events).
async function twist(page: Page, degrees: number, spread = 1) {
  const centre = await visibleCentre(page);
  await page.evaluate(
    ({ x, y, degrees, spread }) => {
      const target = document.elementFromPoint(x, y);
      if (!target) throw new Error('nothing under the visible centre');
      const fire = (type: string, pointerId: number, px: number, py: number) =>
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId,
            pointerType: 'touch',
            isPrimary: pointerId === 11,
            clientX: px,
            clientY: py,
          }),
        );
      const at = (step: number, steps: number) => {
        const a = ((degrees * step) / steps) * (Math.PI / 180);
        const r = 80 * (1 + ((spread - 1) * step) / steps);
        return { dx: r * Math.cos(a), dy: r * Math.sin(a) };
      };
      fire('pointerdown', 11, x - 80, y);
      fire('pointerdown', 12, x + 80, y);
      const steps = Math.max(8, Math.ceil(Math.abs(degrees) / 4));
      let last = at(0, steps);
      for (let step = 1; step <= steps; step++) {
        last = at(step, steps);
        fire('pointermove', 11, x - last.dx, y - last.dy);
        fire('pointermove', 12, x + last.dx, y + last.dy);
      }
      fire('pointerup', 11, x - last.dx, y - last.dy);
      fire('pointerup', 12, x + last.dx, y + last.dy);
    },
    { ...centre, degrees, spread },
  );
}

// The comparisons below read the view off the grid, labels and chrome, with
// the photo's WebGL layer hidden: Playwright's WebKit on Windows stops showing a
// WebGL canvas once it has been resized (even a plain clear), which says
// nothing about the app. The grid is drawn through the same view transform.
async function hideImageLayer(page: Page) {
  await page.addStyleTag({ content: '[data-testid="pane"] canvas:first-child { visibility: hidden !important; }' });
}

// The whole window, once two screenshots in a row agree (any motion after a
// gesture has stopped and the canvas has repainted).
async function settledScreenshot(page: Page): Promise<Buffer> {
  let previous = await page.screenshot();
  let settled: Buffer | null = null;
  await expect
    .poll(async () => {
      const next = await page.screenshot();
      const same = next.equals(previous);
      previous = next;
      if (same) settled = next;
      return same;
    })
    .toBe(true);
  return settled!;
}

const LANDSCAPE = { width: 1180, height: 820 };
const PORTRAIT = { width: 820, height: 1180 };

test.describe('orientation memory', () => {
  test('landscape and portrait each keep their own zoom, pan and angle', async ({ page }) => {
    await page.setViewportSize(LANDSCAPE);
    await importFixture(page);
    await hideImageLayer(page);
    // Landscape: zoomed, turned and panned.
    await twist(page, 50, 1.8);
    await expect(angle(page)).toHaveText('40°');
    const centre = await visibleCentre(page);
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.mouse.move(centre.x - 60, centre.y + 40, { steps: 6 });
    await page.mouse.up();
    const landscape = await settledScreenshot(page);
    const landscapeZoom = await zoomReadout(page).innerText();

    // The first time in portrait, the reference fits, square.
    await page.setViewportSize(PORTRAIT);
    await expect(zoomReadout(page)).toHaveText('100%');
    await expect(angle(page)).toHaveCount(0);
    // Portrait gets a view of its own.
    await twist(page, -70, 1.5);
    await expect(angle(page)).toHaveText('-60°');
    const portrait = await settledScreenshot(page);
    const portraitZoom = await zoomReadout(page).innerText();
    expect(portraitZoom).not.toBe('100%');

    // Turning back restores each orientation's view exactly.
    await page.setViewportSize(LANDSCAPE);
    await expect(angle(page)).toHaveText('40°');
    await expect(zoomReadout(page)).toHaveText(landscapeZoom);
    await expect.poll(async () => (await page.screenshot()).equals(landscape)).toBe(true);

    await page.setViewportSize(PORTRAIT);
    await expect(angle(page)).toHaveText('-60°');
    await expect(zoomReadout(page)).toHaveText(portraitZoom);
    await expect.poll(async () => (await page.screenshot()).equals(portrait)).toBe(true);
  });

  test('each orientation is remembered across a reload, on this device', async ({ page }) => {
    await page.setViewportSize(LANDSCAPE);
    await importFixture(page);
    await twist(page, 40);
    await expect(angle(page)).toHaveText('30°');
    await page.setViewportSize(PORTRAIT);
    await expect(angle(page)).toHaveCount(0);
    await twist(page, -40);
    await expect(angle(page)).toHaveText('-30°');

    await page.reload();
    await expect(page.getByTestId('zoom-pill')).toBeVisible({ timeout: 15000 });
    await expect(angle(page)).toHaveText('-30°');
    await page.setViewportSize(LANDSCAPE);
    await expect(angle(page)).toHaveText('30°');
  });

  test('the angle stored before orientation memory comes back in both orientations', async ({ page }) => {
    await page.setViewportSize(LANDSCAPE);
    await importFixture(page);
    // The reference's id, from what this device stored for it.
    let id = '';
    await expect
      .poll(async () => {
        id = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('artiso.orientationViews.v1') ?? '{}'))[0] ?? '');
        return id;
      })
      .not.toBe('');
    // On the next load, before the app starts, storage holds only the old
    // single-angle form, as an earlier version of the app left it.
    await page.addInitScript((referenceId) => {
      localStorage.removeItem('artiso.orientationViews.v1');
      localStorage.setItem('artiso.viewRotation.v1', JSON.stringify({ [referenceId]: Math.PI / 6 }));
    }, id);
    await page.reload();
    await expect(page.getByTestId('zoom-pill')).toBeVisible({ timeout: 15000 });
    await expect(angle(page)).toHaveText('30°');
    await expect(zoomReadout(page)).toHaveText('100%');
    await page.setViewportSize(PORTRAIT);
    await expect(angle(page)).toHaveText('30°');
    await expect(zoomReadout(page)).toHaveText('100%');
  });
});
