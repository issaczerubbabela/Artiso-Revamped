import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { visibleCentre } from './visible-region';

const FIXTURE_IMAGE = path.join(__dirname, 'fixtures', 'reference.png');

// View Rotation (GLOSSARY.md, issue #5): a two-finger twist turns the reference
// like paper on a desk. View state only -- device-local per reference, never
// exported. Two-finger gestures are dispatched as synthetic touch Pointer
// Events, since Playwright has no multi-touch API.

test.use({ viewport: { width: 1280, height: 800 } });

async function importFixture(page: Page) {
  await page.goto('/');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  await (await fileChooserPromise).setFiles(FIXTURE_IMAGE);
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });
  await expect(page.getByTestId('zoom-pill')).toBeVisible();
}

// Two fingers 160px apart about the visible centre, twisted by `degrees` in
// small steps and spread by `spread` (1 = no pinch), then lifted.
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
        const angle = ((degrees * step) / steps) * (Math.PI / 180);
        const r = 80 * (1 + ((spread - 1) * step) / steps);
        return { dx: r * Math.cos(angle), dy: r * Math.sin(angle) };
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

// Two quick taps at the visible centre (touch).
async function doubleTap(page: Page) {
  const centre = await visibleCentre(page);
  await page.evaluate(({ x, y }) => {
    const target = document.elementFromPoint(x, y);
    if (!target) throw new Error('nothing under the visible centre');
    for (const pointerId of [21, 22]) {
      for (const type of ['pointerdown', 'pointerup']) {
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId,
            pointerType: 'touch',
            isPrimary: true,
            clientX: x,
            clientY: y,
          }),
        );
      }
    }
  }, centre);
}

const angle = (page: Page) => page.getByTestId('rotation-readout');
const shownAngle = (page: Page) => page.locator('[data-view-rotation]').first();
const zoomReadout = (page: Page) => page.getByTestId('zoom-readout');

test.describe('turning the view', () => {
  test('a twist under the dead zone does nothing; past it the view turns', async ({ page }) => {
    await importFixture(page);
    await expect(shownAngle(page)).toHaveAttribute('data-view-rotation', '0');

    await twist(page, 8);
    await expect(angle(page)).toHaveCount(0);
    await expect(shownAngle(page)).toHaveAttribute('data-view-rotation', '0');

    // 40° of twist turns the view 30°: it starts at the edge of the dead zone.
    await twist(page, 40);
    await expect(angle(page)).toHaveText('30°');
    await expect(shownAngle(page)).toHaveAttribute('data-view-rotation', '30');
  });

  test('snaps to a right angle on release, and tapping the angle resets it', async ({ page }) => {
    await importFixture(page);
    await twist(page, 96); // 86° shown, within 5° of 90°
    await expect(angle(page)).toHaveText('90°');

    await angle(page).click();
    await expect(angle(page)).toHaveCount(0);
    await expect(shownAngle(page)).toHaveAttribute('data-view-rotation', '0');
  });

  test('pinch and twist work in one gesture', async ({ page }) => {
    await importFixture(page);
    await twist(page, 50, 1.8);
    await expect(angle(page)).toHaveText('40°');
    await expect
      .poll(async () => Number.parseInt((await zoomReadout(page).innerText()).replace('%', ''), 10))
      .toBeGreaterThan(100);
  });

  test('double-tap fits and squares up', async ({ page }) => {
    await importFixture(page);
    await twist(page, 50, 1.8);
    await expect(angle(page)).toHaveText('40°');
    await doubleTap(page);
    await expect(angle(page)).toHaveCount(0);
    await expect(zoomReadout(page)).toHaveText('100%');
  });

  test('a stroke lands under the pointer at an angle', async ({ page }) => {
    await importFixture(page);
    await twist(page, 50);
    await expect(angle(page)).toHaveText('40°');
    await page.getByRole('button', { name: 'Draw', exact: true }).click();
    // The Draw panel's dock changes the pane's insets (and so the visible
    // centre and the view's framing) a moment after the click: wait for it.
    await expect(page.getByTestId('side-dock')).toHaveAttribute('aria-hidden', 'false');
    const pane = page.getByTestId('pane').first();
    await expect
      .poll(async () => Number(await pane.getAttribute('data-inset-right')))
      .toBeGreaterThan(0);
    const { x, y } = await visibleCentre(page);
    await page.mouse.move(x - 60, y - 30);
    await page.mouse.down();
    await page.mouse.move(x + 60, y + 30, { steps: 12 });
    await page.mouse.up();

    // The annotation canvas is painted along the whole drag. The canvas only
    // repaints on animation frames, so a frame drawn mid-drag can still show
    // part of the stroke: wait until the committed stroke is painted end to
    // end, then check nothing is painted off the line.
    const sample = () =>
      page.evaluate(
        ({ x, y }) => {
          const canvas = document.querySelector(
            'canvas[data-layer="annotation"]',
          ) as HTMLCanvasElement;
          const rect = canvas.getBoundingClientRect();
          const ratio = canvas.width / rect.width;
          const ctx = canvas.getContext('2d')!;
          const alphaAt = (px: number, py: number) => {
            const data = ctx.getImageData(
              Math.round((px - rect.left) * ratio) - 2,
              Math.round((py - rect.top) * ratio) - 2,
              5,
              5,
            ).data;
            let max = 0;
            for (let i = 3; i < data.length; i += 4) max = Math.max(max, data[i]!);
            return max;
          };
          return {
            middle: alphaAt(x, y),
            along: alphaAt(x + 40, y + 20),
            off: alphaAt(x + 40, y - 40),
          };
        },
        { x, y },
      );
    await expect
      .poll(async () => {
        const p = await sample();
        return p.middle > 0 && p.along > 0;
      })
      .toBe(true);
    const painted = await sample();
    expect(painted.middle).toBeGreaterThan(0);
    expect(painted.along).toBeGreaterThan(0);
    expect(painted.off).toBe(0);
  });
});

test.describe('Lock rotation and memory', () => {
  test('Lock rotation ignores the twist but keeps pinch, and is remembered', async ({ page }) => {
    await importFixture(page);
    await page.getByRole('button', { name: 'Rotate/Flip', exact: true }).click();
    const lock = page.getByRole('switch', { name: 'Lock rotation' });
    await lock.click();
    await expect(lock).toHaveAttribute('aria-checked', 'true');

    await twist(page, 60, 1.8);
    await expect(angle(page)).toHaveCount(0);
    await expect
      .poll(async () => Number.parseInt((await zoomReadout(page).innerText()).replace('%', ''), 10))
      .toBeGreaterThan(100);

    await page.reload();
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Rotate/Flip', exact: true }).click();
    await expect(page.getByRole('switch', { name: 'Lock rotation' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  test('the angle comes back after a reload, on this device', async ({ page }) => {
    await importFixture(page);
    await twist(page, 40);
    await expect(angle(page)).toHaveText('30°');

    await page.reload();
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });
    await expect(angle(page)).toHaveText('30°');
    await expect(shownAngle(page)).toHaveAttribute('data-view-rotation', '30');
  });
});

test.describe('mode rules', () => {
  test('the Paper tool shows 0° and gives the angle back on exit', async ({ page }) => {
    await importFixture(page);
    await twist(page, 40);
    await expect(angle(page)).toHaveText('30°');

    await page.getByRole('button', { name: 'Paper', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
    await expect(shownAngle(page)).toHaveAttribute('data-view-rotation', '0');
    // A twist in the Paper tool never turns the crop.
    await twist(page, 60);
    await expect(shownAngle(page)).toHaveAttribute('data-view-rotation', '0');

    await page.getByRole('button', { name: 'Done' }).click();
    await expect(angle(page)).toHaveText('30°');
    await expect(shownAngle(page)).toHaveAttribute('data-view-rotation', '30');
  });

  test('Presentation mode keeps the angle and re-fits the zoom', async ({ page }) => {
    await importFixture(page);
    await twist(page, 40, 1.8);
    await expect(angle(page)).toHaveText('30°');
    await expect(zoomReadout(page)).not.toHaveText('100%');

    await page.getByRole('button', { name: 'Present' }).click();
    await expect(page.getByRole('button', { name: 'Exit presentation' })).toBeVisible();
    await expect(shownAngle(page)).toHaveAttribute('data-view-rotation', '30');

    await page.getByRole('button', { name: 'Exit presentation' }).click();
    await expect(angle(page)).toHaveText('30°');
    await expect(zoomReadout(page)).toHaveText('100%');
  });

  test('Real size keeps the angle', async ({ page }) => {
    await importFixture(page);
    await twist(page, 40);
    await expect(angle(page)).toHaveText('30°');

    await page.getByRole('button', { name: 'Real size' }).click();
    const dialog = page.getByRole('dialog', { name: 'Calibrate your screen' });
    const field = dialog.getByLabel('Screen diagonal (inches)');
    await field.fill('13.3');
    await field.press('Enter');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('real-size-badge')).toBeVisible();
    await expect(angle(page)).toHaveText('30°');
  });
});

test('export output is identical whatever the angle', async ({ page }) => {
  await importFixture(page);
  await page.getByRole('button', { name: 'Export', exact: true }).click();

  async function exportBytes(): Promise<Buffer> {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export image' }).click();
    const download = await downloadPromise;
    const filePath = await download.path();
    if (!filePath) throw new Error('no download path');
    return readFile(filePath);
  }

  const square = await exportBytes();
  await twist(page, 47);
  await expect(angle(page)).toHaveText('37°');
  const turned = await exportBytes();
  expect(turned.length).toBeGreaterThan(1000);
  expect(turned.equals(square)).toBe(true);
});
