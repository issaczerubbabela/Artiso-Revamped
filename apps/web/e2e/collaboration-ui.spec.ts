import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { visibleCentre } from './visible-region';

const FIXTURE_IMAGE = path.join(__dirname, 'fixtures', 'reference.png');

async function importFixture(page: Page) {
  await page.goto('/');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(FIXTURE_IMAGE);
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });
}

// Edits the app's IndexedDB directly, the way a sync from the server (or an
// older version of the app) would have left it.
async function patchStore(page: Page, storeName: 'projects' | 'references', patch: 'viewer' | 'legacy') {
  await page.evaluate(
    async ({ storeName, patch }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('artiso');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const rows = await new Promise<Record<string, unknown>[]>((resolve) => {
        const query = store.getAll();
        query.onsuccess = () => resolve(query.result);
      });
      for (const row of rows) {
        if (patch === 'viewer') {
          store.put({ ...row, role: 'viewer' });
        } else {
          // A reference saved before the guide types, annotations, layered
          // grids and collaboration tombstones existed.
          const legacy = { ...row } as Record<string, unknown>;
          delete legacy.annotations;
          delete legacy.removedAnnotationIds;
          delete legacy.secondaryGridConfig;
          // ...and before the drawing-grid overhaul gave it a paper, a crop and grid settings.
          delete legacy.paper;
          delete legacy.crop;
          delete legacy.gridSettings;
          const legacyGrid = { ...(legacy.gridConfig as Record<string, unknown>) };
          delete legacyGrid.type;
          legacy.gridConfig = legacyGrid;
          store.put(legacy);
        }
      }
      await new Promise((resolve) => {
        tx.oncomplete = resolve;
      });
      db.close();
    },
    { storeName, patch },
  );
}

async function readReferences(page: Page): Promise<Record<string, unknown>[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('artiso');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = await new Promise<Record<string, unknown>[]>((resolve) => {
      const query = db.transaction('references').objectStore('references').getAll();
      query.onsuccess = () => resolve(query.result);
    });
    db.close();
    return rows;
  });
}

test('a project shared as view-only opens read-only', async ({ page }) => {
  await importFixture(page);
  await page.waitForTimeout(800); // let the first persist land before patching
  await patchStore(page, 'projects', 'viewer');
  await page.reload();
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });

  await expect(page.getByText('View only')).toBeVisible();
  for (const name of ['Paper', 'Rotate/Flip', 'Adjust', 'Filters', 'Grid', 'Draw', 'Presets']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  }
  // Looking and exporting still work.
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Present' })).toBeEnabled();
});

test('a project shared with you shows who it is from and can be left, not edited or deleted', async ({ page }) => {
  await importFixture(page);
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('artiso');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction('projects', 'readwrite');
    tx.objectStore('projects').put({
      id: '99999999-9999-4999-8999-999999999999',
      ownerId: '88888888-8888-4888-8888-888888888888',
      name: 'Team study',
      tags: [],
      thumbnailAssetId: null,
      role: 'editor',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
    });
    db.close();
  });

  await page.getByRole('button', { name: 'Projects' }).click();
  const cards = page.locator('[data-testid="project-role"]');
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText('can edit');
  await expect(page.getByRole('button', { name: 'Leave' })).toBeVisible();
  // Only your own project offers Rename/Delete; signed out, no Share either.
  await expect(page.getByRole('button', { name: 'Rename' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Share' })).toHaveCount(0);
});

test('deleting an annotation is remembered so a merge cannot bring it back', async ({ page }) => {
  await importFixture(page);
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  const { x: cx, y: cy } = await visibleCentre(page);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 60, cy + 40, { steps: 5 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Undo last' }).click();
  await page.waitForTimeout(800);

  const [reference] = await readReferences(page);
  expect(reference?.annotations).toEqual([]);
  expect(reference?.removedAnnotationIds).toHaveLength(1);
});

test('a reference saved before newer fields existed still opens and works', async ({ page }) => {
  await importFixture(page);
  await page.waitForTimeout(800);
  await patchStore(page, 'references', 'legacy');
  await page.reload();
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });

  // These panels read annotations / gridSettings; on unnormalized legacy
  // data they used to throw.
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo last' })).toBeDisabled();
  await page.getByRole('button', { name: 'Grid', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Squares' })).toBeVisible();
});

test('a reference saved before the drawing-grid overhaul is migrated onto A4 and keeps working', async ({ page }) => {
  await importFixture(page);
  await page.waitForTimeout(800);
  await patchStore(page, 'references', 'legacy');
  const [stripped] = await readReferences(page);
  expect(stripped?.paper).toBeUndefined();
  expect(stripped?.gridSettings).toBeUndefined();

  await page.reload();
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });
  // Opening it went straight into a working grid...
  await page.getByRole('button', { name: 'Grid', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Squares' })).toHaveAttribute('aria-checked', 'true');

  // ...and the migration was written back, so it only ever happens once.
  await page.waitForTimeout(800);
  const [migrated] = await readReferences(page);
  expect(migrated?.paper).toMatchObject({ preset: 'A4', orientation: 'landscape', widthMm: 297, heightMm: 210 });
  const crop = migrated?.crop as { x: number; y: number; w: number; h: number };
  expect(crop.w / crop.h).toBeCloseTo(297 / 210, 6);
  expect(migrated?.gridSettings).toMatchObject({ showSquares: true, marginMm: 0 });
});
