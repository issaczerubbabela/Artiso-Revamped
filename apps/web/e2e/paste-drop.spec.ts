import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { solidPng } from './pixels';

const FIXTURE_IMAGE = path.join(__dirname, 'fixtures', 'reference.png');

// Paste and drop (issue #10): a copied or dragged-in image opens as a new
// reference tab through the same import path as the file picker; HEIC opens
// where the browser can decode it; anything else gets a clear message on the
// import-error surface. Wide, so the tabs are on screen.

test.use({ viewport: { width: 1280, height: 800 } });

interface FileSpec {
  name: string;
  type: string;
  bytes: Buffer;
}

const png = (name: string, colour: [number, number, number]): FileSpec => ({
  name,
  type: 'image/png',
  bytes: solidPng(64, 48, colour),
});

async function importFixture(page: Page) {
  await page.goto('/');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  await (await fileChooserPromise).setFiles(FIXTURE_IMAGE);
  await expect(page.getByTestId('zoom-pill')).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('tab')).toHaveCount(1);
}

// Builds a DataTransfer holding `files` inside the page.
const serialise = (files: FileSpec[]) => files.map((f) => ({ name: f.name, type: f.type, b64: f.bytes.toString('base64') }));

// A paste event, as ⌘V / Ctrl+V delivers it, carrying `files` (and optional text).
async function paste(page: Page, files: FileSpec[], text?: string) {
  await page.evaluate(
    ({ files, text }) => {
      const data = new DataTransfer();
      for (const f of files) {
        const bytes = Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0));
        data.items.add(new File([bytes], f.name, { type: f.type }));
      }
      if (text !== undefined) data.setData('text/plain', text);
      const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data });
      // Not every engine takes clipboardData through the constructor.
      if (event.clipboardData !== data) Object.defineProperty(event, 'clipboardData', { value: data });
      document.body.dispatchEvent(event);
    },
    { files: serialise(files), text },
  );
}

// A drag of `files` entering the app over the canvas, then (unless `drop` is
// false) dropped there.
async function drag(page: Page, files: FileSpec[], { drop = true } = {}) {
  await page.evaluate(
    ({ files, drop }) => {
      const data = new DataTransfer();
      for (const f of files) {
        const bytes = Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0));
        data.items.add(new File([bytes], f.name, { type: f.type }));
      }
      const target = document.querySelector('[data-testid="pane"], .surface') ?? document.body;
      const fire = (type: string) => {
        const event = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data });
        if (event.dataTransfer !== data) Object.defineProperty(event, 'dataTransfer', { value: data });
        target.dispatchEvent(event);
      };
      fire('dragenter');
      fire('dragover');
      if (drop) fire('drop');
    },
    { files: serialise(files), drop },
  );
}

const notice = (page: Page) => page.getByTestId('import-notice');

// The Projects screen is pre-rendered, so its button shows before the app has
// hydrated and started listening for paste and drop. A drag entering the window
// shows the drop target once it is listening; the drag is then abandoned.
async function waitUntilListening(page: Page) {
  await expect
    .poll(async () => {
      await page.evaluate(() => {
        const data = new DataTransfer();
        data.items.add(new File(['x'], 'probe.png', { type: 'image/png' }));
        const event = new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: data });
        if (event.dataTransfer !== data) Object.defineProperty(event, 'dataTransfer', { value: data });
        document.body.dispatchEvent(event);
      });
      return page.getByTestId('drop-target').count();
    })
    .toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event('dragend')));
  await expect(page.getByTestId('drop-target')).toHaveCount(0);
}

test.describe('paste', () => {
  test('⌘V / Ctrl+V with a copied image opens it as a new tab', async ({ page }) => {
    await importFixture(page);
    await paste(page, [png('copied.png', [30, 140, 220])]);
    await expect(page.getByRole('tab')).toHaveCount(2);
    // The new reference is the one showing.
    await expect(page.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(notice(page)).toHaveCount(0);
  });

  test('pasting on the Projects screen opens the image in the workspace', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'New reference' })).toBeVisible();
    await waitUntilListening(page);
    await paste(page, [png('copied.png', [200, 90, 40])]);
    await expect(page.getByTestId('zoom-pill')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('tab')).toHaveCount(1);
  });

  test('Paste in the canvas menu opens a copied image as a new tab', async ({ page }) => {
    // The system clipboard, standing in for one holding a copied photo.
    await page.addInitScript((b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'image/png' });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { read: async () => [{ types: ['text/plain', 'image/png'], getType: async () => blob }] },
      });
    }, solidPng(64, 48, [60, 160, 90]).toString('base64'));
    await importFixture(page);
    await page.getByTestId('pane').click({ button: 'right' });
    await page.getByRole('menu', { name: 'Canvas' }).getByRole('menuitem', { name: 'Paste' }).click();
    await expect(page.getByRole('tab')).toHaveCount(2);
  });

  test('pasting text says only images can be pasted, and typing in a field is left alone', async ({ page }) => {
    await importFixture(page);
    await paste(page, [], 'some words');
    await expect(notice(page)).toContainText('no image to paste');
    await expect(page.getByRole('tab')).toHaveCount(1);
    await notice(page).getByRole('button', { name: 'Dismiss' }).click();
    await expect(notice(page)).toHaveCount(0);

    // An image pasted into a text field is the field's business.
    await page.getByRole('button', { name: 'Grid', exact: true }).click();
    const field = page.getByLabel(/^Exact cell size/);
    await field.focus();
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.items.add(new File([new Uint8Array([1, 2, 3])], 'x.png', { type: 'image/png' }));
      const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data });
      if (event.clipboardData !== data) Object.defineProperty(event, 'clipboardData', { value: data });
      document.activeElement!.dispatchEvent(event);
    });
    await expect(notice(page)).toHaveCount(0);
    await expect(page.getByRole('tab')).toHaveCount(1);
  });
});

test.describe('drop', () => {
  test('dragging an image over the app shows the drop target; dropping opens a new tab', async ({ page }) => {
    await importFixture(page);
    await drag(page, [png('dragged.png', [180, 60, 160])], { drop: false });
    await expect(page.getByTestId('drop-target')).toBeVisible();
    await drag(page, [png('dragged.png', [180, 60, 160])]);
    await expect(page.getByTestId('drop-target')).toHaveCount(0);
    await expect(page.getByRole('tab')).toHaveCount(2);
  });

  test('dropping several images opens each as its own tab', async ({ page }) => {
    await importFixture(page);
    await drag(page, [png('one.png', [220, 40, 40]), png('two.png', [40, 180, 60]), png('three.png', [40, 80, 220])]);
    await expect(page.getByRole('tab')).toHaveCount(4);
    await expect(notice(page)).toHaveCount(0);
  });

  test('an image that cannot be decoded says so, and opens nothing', async ({ page }) => {
    await importFixture(page);
    await drag(page, [{ name: 'broken.png', type: 'image/png', bytes: Buffer.from('not really a png') }]);
    await expect(notice(page)).toContainText('Could not decode');
    await expect(page.getByRole('tab')).toHaveCount(1);
  });

  test('a HEIC photo the browser cannot open asks for a JPEG', async ({ page }) => {
    await importFixture(page);
    // Untyped, as from the iPad Files app: the extension says HEIC. These bytes
    // are no photo any browser can decode.
    await drag(page, [{ name: 'IMG_0001.HEIC', type: '', bytes: Buffer.from('ftypheic but not really') }]);
    await expect(notice(page)).toContainText('Convert it to JPEG');
    await expect(page.getByRole('tab')).toHaveCount(1);
  });

  test('dropping something that is not an image says so, while the images in the drop still open', async ({ page }) => {
    await importFixture(page);
    await drag(page, [
      { name: 'notes.txt', type: 'text/plain', bytes: Buffer.from('hello') },
      png('photo.png', [90, 90, 200]),
    ]);
    await expect(page.getByRole('tab')).toHaveCount(2);
    await expect(notice(page)).toContainText('"notes.txt" isn\'t an image');
  });

  test('a failed drop on the Projects screen shows on its import-error surface', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'New reference' })).toBeVisible();
    await waitUntilListening(page);
    await drag(page, [{ name: 'notes.txt', type: 'text/plain', bytes: Buffer.from('hello') }]);
    await expect(page.getByRole('alert').filter({ hasText: 'notes.txt' })).toContainText('"notes.txt" isn\'t an image');
  });
});

test('the import notice fits a Slide Over window', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 });
  await page.goto('/');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  await (await fileChooserPromise).setFiles(FIXTURE_IMAGE);
  await expect(page.getByTestId('zoom-pill')).toBeVisible({ timeout: 15000 });
  await drag(page, [{ name: 'IMG_0002.heic', type: 'image/heic', bytes: Buffer.from('ftypheic, not a real photo') }]);
  await expect(notice(page)).toContainText('Convert it to JPEG');
  const box = (await notice(page).boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
});
