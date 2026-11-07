import path from 'node:path';
import { test, expect, type Locator, type Page } from '@playwright/test';
import { visibleCentre } from './visible-region';

const FIXTURE_IMAGE = path.join(__dirname, 'fixtures', 'reference.png');

// iPad-native chrome (issue #6, docs/design.md §7): popovers for the small
// panels, a side column or a bottom sheet with resting heights for the large
// ones, the canvas menu, and San Francisco on Apple platforms.

const WIDE = { width: 1280, height: 800 };
// iPad Air 11" in portrait: the Regular breakpoint.
const REGULAR = { width: 820, height: 1180 };
const COMPACT = { width: 390, height: 844 };

const IPAD_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function importFixture(page: Page) {
  await page.goto('/');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  await (await fileChooserPromise).setFiles(FIXTURE_IMAGE);
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });
  await expect(page.getByTestId('zoom-pill')).toBeVisible();
}

const tool = (page: Page, name: string) => page.getByTestId('side-rail').getByRole('button', { name, exact: true });
const popover = (page: Page) => page.getByTestId('panel-popover');
const sheet = (page: Page) => page.getByTestId('bottom-sheet');
const menu = (page: Page) => page.getByRole('menu', { name: 'Canvas' });

async function centreY(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('no bounding box');
  return box.y + box.height / 2;
}

test.describe('popovers (Wide)', () => {
  test.use({ viewport: WIDE });

  test('a small panel opens as a popover pointing at its rail button and closes on an outside tap', async ({ page }) => {
    await importFixture(page);
    await tool(page, 'Adjust').click();
    await expect(popover(page)).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Adjustments' })).toBeVisible();
    await expect(page.getByTestId('side-dock')).toHaveAttribute('aria-hidden', 'true');

    // Beside the rail, with its arrow level with the button.
    const button = tool(page, 'Adjust');
    const buttonBox = (await button.boundingBox())!;
    const popoverBox = (await popover(page).boundingBox())!;
    expect(popoverBox.x).toBeGreaterThan(buttonBox.x + buttonBox.width);
    expect(Math.abs((await centreY(popover(page).locator('.popover__arrow'))) - (await centreY(button)))).toBeLessThan(2);

    // A tap on the photo puts it away and turns the tool off.
    const { x, y } = await visibleCentre(page);
    await page.mouse.click(x, y);
    await expect(popover(page)).toHaveCount(0);
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  test('Esc closes a popover and returns focus to its rail button', async ({ page }) => {
    await importFixture(page);
    await tool(page, 'Presets').click();
    await expect(page.getByRole('dialog', { name: 'Presets' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popover(page)).toHaveCount(0);
    await expect(tool(page, 'Presets')).toBeFocused();
    await expect(tool(page, 'Presets')).toHaveAttribute('aria-pressed', 'false');
  });

  test('the keyboard reaches a popover: focus moves in, Tab walks its controls', async ({ page }) => {
    await importFixture(page);
    await tool(page, 'Rotate/Flip').focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Rotate & flip' });
    await expect(dialog).toBeFocused();
    await page.keyboard.press('Tab');
    await expect.poll(() => dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  });

  test('the Draw popover stays open while drawing on the canvas, and closes on a tap on other chrome', async ({ page }) => {
    await importFixture(page);
    await tool(page, 'Draw').click();
    const dialog = page.getByRole('dialog', { name: 'Draw' });
    await expect(dialog).toBeVisible();
    const { x, y } = await visibleCentre(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 80, y + 40, { steps: 5 });
    await page.mouse.up();
    await expect(dialog.getByRole('button', { name: 'Undo last' })).toBeEnabled();
    await expect(tool(page, 'Draw')).toHaveAttribute('aria-pressed', 'true');
    // A tap on other chrome is outside it: choosing Grid swaps the panels.
    await tool(page, 'Grid').click();
    await expect(popover(page)).toHaveCount(0);
    await expect(tool(page, 'Draw')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('side-dock')).toHaveAttribute('aria-hidden', 'false');
  });
});

test.describe('large panels by breakpoint', () => {
  test.describe('Wide', () => {
    test.use({ viewport: WIDE });
    test('Grid, Filters and Export open in the side column', async ({ page }) => {
      await importFixture(page);
      for (const name of ['Grid', 'Filters', 'Export']) {
        await tool(page, name).click();
        await expect(page.getByTestId('side-dock')).toHaveAttribute('aria-hidden', 'false');
        await expect(sheet(page)).toHaveCount(0);
        await expect(popover(page)).toHaveCount(0);
      }
    });
  });

  test.describe('Regular (iPad portrait)', () => {
    test.use({ viewport: REGULAR });
    test('Grid, Filters and Export open as a bottom sheet; small panels stay popovers', async ({ page }) => {
      await importFixture(page);
      for (const name of ['Grid', 'Filters', 'Export']) {
        await tool(page, name).click();
        await expect(sheet(page)).toBeVisible();
        await expect(page.getByTestId('side-dock')).toHaveAttribute('aria-hidden', 'true');
      }
      // Beside the rail, not under it.
      const railBox = (await page.getByTestId('side-rail').boundingBox())!;
      const sheetBox = (await sheet(page).boundingBox())!;
      expect(sheetBox.x).toBeGreaterThan(railBox.x + railBox.width);

      await tool(page, 'Adjust').click();
      await expect(popover(page)).toBeVisible();
      await expect(sheet(page)).toHaveCount(0);
    });
  });

  test.describe('Compact', () => {
    test.use({ viewport: COMPACT });
    test('every panel is a bottom sheet', async ({ page }) => {
      await importFixture(page);
      for (const name of ['Adjust', 'Grid']) {
        await page.getByTestId('bottom-toolbar').getByRole('button', { name, exact: true }).click();
        await expect(sheet(page)).toBeVisible();
        await expect(popover(page)).toHaveCount(0);
      }
    });
  });
});

test.describe('sheet heights', () => {
  test.use({ viewport: REGULAR });

  async function dragGrabber(page: Page, toY: number) {
    const grabber = page.getByTestId('sheet-grabber');
    const box = (await grabber.boundingBox())!;
    const x = box.x + box.width / 2;
    await page.mouse.move(x, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, toY, { steps: 8 });
    await page.mouse.up();
  }

  const sheetHeight = async (page: Page) => (await sheet(page).boundingBox())!.height;

  test('a sheet has a grab bar and rests at peek, half or full', async ({ page }) => {
    await importFixture(page);
    await tool(page, 'Grid').click();
    await expect(sheet(page)).toHaveAttribute('data-detent', 'half');
    const half = await sheetHeight(page);
    expect(half).toBeGreaterThan(REGULAR.height * 0.4);
    expect(half).toBeLessThan(REGULAR.height * 0.55);

    // Up past the top: full height.
    await dragGrabber(page, 0);
    await expect(sheet(page)).toHaveAttribute('data-detent', 'full');
    expect(await sheetHeight(page)).toBeGreaterThan(REGULAR.height * 0.85);

    // Down to just above the peek height: peek.
    const bottom = (await sheet(page).boundingBox())!;
    await dragGrabber(page, bottom.y + bottom.height - 175);
    await expect(sheet(page)).toHaveAttribute('data-detent', 'peek');
    expect(await sheetHeight(page)).toBeLessThan(200);

    // The grab bar is a keyboard slider too.
    const grabber = page.getByRole('slider', { name: 'Sheet size' });
    await expect(grabber).toHaveAttribute('aria-valuetext', 'Peek');
    await grabber.focus();
    await page.keyboard.press('ArrowUp');
    await expect(grabber).toHaveAttribute('aria-valuetext', 'Half');
    await expect(sheet(page)).toHaveAttribute('data-detent', 'half');
    await page.keyboard.press('End');
    await expect(sheet(page)).toHaveAttribute('data-detent', 'full');
  });

  test('swiping a sheet down closes it', async ({ page }) => {
    await importFixture(page);
    await tool(page, 'Filters').click();
    await expect(sheet(page)).toBeVisible();
    await dragGrabber(page, REGULAR.height);
    await expect(sheet(page)).toHaveCount(0);
    await expect(tool(page, 'Filters')).toHaveAttribute('aria-pressed', 'false');
  });

  test('a touch swipe down closes it too', async ({ page }) => {
    await importFixture(page);
    await tool(page, 'Export').click();
    const box = (await page.getByTestId('sheet-grabber').boundingBox())!;
    await page.evaluate(
      ({ x, y, to }) => {
        const target = document.querySelector('[data-testid="sheet-grabber"]')!;
        const fire = (type: string, py: number) =>
          target.dispatchEvent(
            new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 31, pointerType: 'touch', isPrimary: true, clientX: x, clientY: py }),
          );
        fire('pointerdown', y);
        for (let step = 1; step <= 10; step++) fire('pointermove', y + ((to - y) * step) / 10);
        fire('pointerup', to);
      },
      { x: box.x + box.width / 2, y: box.y + box.height / 2, to: REGULAR.height },
    );
    await expect(sheet(page)).toHaveCount(0);
  });

  test('Esc closes a sheet', async ({ page }) => {
    await importFixture(page);
    await tool(page, 'Grid').click();
    await page.getByRole('slider', { name: 'Sheet size' }).focus();
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toHaveCount(0);
  });
});

// Two fingers 160px apart about the visible centre, twisted by `degrees`.
async function twist(page: Page, degrees: number) {
  const centre = await visibleCentre(page);
  await page.evaluate(
    ({ x, y, degrees }) => {
      const target = document.elementFromPoint(x, y)!;
      const fire = (type: string, pointerId: number, px: number, py: number) =>
        target.dispatchEvent(
          new PointerEvent(type, { bubbles: true, cancelable: true, pointerId, pointerType: 'touch', isPrimary: pointerId === 11, clientX: px, clientY: py }),
        );
      const steps = Math.ceil(degrees / 4);
      let dx = 80;
      let dy = 0;
      fire('pointerdown', 11, x - 80, y);
      fire('pointerdown', 12, x + 80, y);
      for (let step = 1; step <= steps; step++) {
        const a = ((degrees * step) / steps) * (Math.PI / 180);
        dx = 80 * Math.cos(a);
        dy = 80 * Math.sin(a);
        fire('pointermove', 11, x - dx, y - dy);
        fire('pointermove', 12, x + dx, y + dy);
      }
      fire('pointerup', 11, x - dx, y - dy);
      fire('pointerup', 12, x + dx, y + dy);
    },
    { ...centre, degrees },
  );
}

// Painted pixels on the grid canvas.
const gridInk = (page: Page) =>
  page.locator('canvas[data-layer="grid"]').first().evaluate((canvas: HTMLCanvasElement) => {
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
    let count = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) count++;
    return count;
  });

test.describe('canvas menu', () => {
  test.use({ viewport: WIDE });

  async function rightClickCanvas(page: Page) {
    const { x, y } = await visibleCentre(page);
    await page.mouse.click(x, y, { button: 'right' });
    await expect(menu(page)).toBeVisible();
  }

  test('right-click opens it; Reset rotation, Fit to screen and Show/hide grid work', async ({ page }) => {
    await importFixture(page);
    await expect.poll(() => gridInk(page)).toBeGreaterThan(0);

    // Turned and zoomed in.
    await twist(page, 50);
    await expect(page.getByTestId('rotation-readout')).toHaveText('40°');
    const { x, y } = await visibleCentre(page);
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, -400);
    await expect(page.getByTestId('zoom-readout')).not.toHaveText('100%');

    await rightClickCanvas(page);
    await expect(menu(page).getByRole('menuitem')).toHaveText(['Fit to screen', 'Reset rotation', 'Hide grid', 'Focus this cell', 'Paste']);
    await menu(page).getByRole('menuitem', { name: 'Reset rotation' }).click();
    await expect(menu(page)).toHaveCount(0);
    await expect(page.getByTestId('rotation-readout')).toHaveCount(0);

    await rightClickCanvas(page);
    await menu(page).getByRole('menuitem', { name: 'Fit to screen' }).click();
    await expect(page.getByTestId('zoom-readout')).toHaveText('100%');

    await rightClickCanvas(page);
    await menu(page).getByRole('menuitem', { name: 'Hide grid' }).click();
    await expect.poll(() => gridInk(page)).toBe(0);

    await rightClickCanvas(page);
    await menu(page).getByRole('menuitem', { name: 'Show grid' }).click();
    await expect.poll(() => gridInk(page)).toBeGreaterThan(0);
  });

  test('a long-press opens it at the finger', async ({ page }) => {
    await importFixture(page);
    const { x, y } = await visibleCentre(page);
    await page.evaluate(
      ({ x, y }) => {
        const target = document.elementFromPoint(x, y)!;
        target.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y }),
        );
      },
      { x, y },
    );
    await expect(menu(page)).toBeVisible();
    // Just below and to the right of the finger, so it is not under it.
    const box = (await menu(page).boundingBox())!;
    expect(box.x).toBeGreaterThan(x);
    expect(box.y).toBeGreaterThan(y);
    // A tap elsewhere closes it.
    await page.mouse.click(40, 40);
    await expect(menu(page)).toHaveCount(0);
  });

  test('the keyboard opens and walks it', async ({ page }) => {
    await importFixture(page);
    const pane = page.getByTestId('pane').first();
    await pane.focus();
    await page.keyboard.press('Shift+F10');
    await expect(menu(page)).toBeVisible();
    await expect(menu(page).getByRole('menuitem', { name: 'Fit to screen' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu(page).getByRole('menuitem', { name: 'Reset rotation' })).toBeFocused();
    await page.keyboard.press('End');
    await expect(menu(page).getByRole('menuitem', { name: 'Paste' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(menu(page).getByRole('menuitem', { name: 'Focus this cell' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu(page)).toHaveCount(0);
    await expect(pane).toBeFocused();
  });
});

test.describe('touch targets', () => {
  test.use({ viewport: REGULAR });

  test('popover, sheet and menu controls are at least 44px', async ({ page }) => {
    await importFixture(page);
    const check = async (scope: Locator) => {
      const controls = scope.locator('button, [role="slider"], [role="switch"]');
      const count = await controls.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const control = controls.nth(i);
        if (!(await control.isVisible())) continue;
        const box = await control.boundingBox();
        if (!box) continue;
        expect(box.height, await control.evaluate((el) => el.outerHTML.slice(0, 80))).toBeGreaterThanOrEqual(44);
      }
    };
    await tool(page, 'Rotate/Flip').click();
    await check(popover(page));
    await tool(page, 'Grid').click();
    await check(page.getByTestId('bottom-sheet').locator('.sheet__top'));
    await tool(page, 'Grid').click();
    const { x, y } = await visibleCentre(page);
    await page.mouse.click(x, y, { button: 'right' });
    await check(menu(page));
  });
});

test.describe('Apple type', () => {
  test.describe('on an iPad', () => {
    test.use({ userAgent: IPAD_UA, viewport: WIDE });
    test('uses San Francisco and SF Mono, and no Space Grotesk', async ({ page }) => {
      await importFixture(page);
      await expect(page.locator('html')).toHaveAttribute('data-platform', 'apple');
      const body = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
      expect(body).toMatch(/^system-ui/);
      expect(body).not.toMatch(/manrope/i);
      const readout = await page.getByTestId('zoom-readout').evaluate((el) => getComputedStyle(el).fontFamily);
      expect(readout).toMatch(/^ui-monospace/);
      await tool(page, 'Grid').click();
      const heading = await page.getByTestId('side-dock').locator('.panel-title').evaluate((el) => getComputedStyle(el).fontFamily);
      expect(heading).not.toMatch(/grotesk/i);
      expect(heading).toMatch(/^system-ui/);
    });
  });

  test.describe('elsewhere', () => {
    test.use({ userAgent: WINDOWS_UA, viewport: WIDE });
    test('keeps Manrope and JetBrains Mono', async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'Win32' });
        Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => undefined });
      });
      await importFixture(page);
      await expect(page.locator('html')).not.toHaveAttribute('data-platform', 'apple');
      const body = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
      expect(body).toMatch(/manrope/i);
      const readout = await page.getByTestId('zoom-readout').evaluate((el) => getComputedStyle(el).fontFamily);
      expect(readout).toMatch(/jetbrains/i);
    });
  });
});
