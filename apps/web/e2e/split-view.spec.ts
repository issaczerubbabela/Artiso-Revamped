import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { visibleCentre } from './visible-region';

const FIXTURE_IMAGE = path.join(__dirname, 'fixtures', 'reference.png');

async function importViaNewReference(page: Page) {
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'New reference' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(FIXTURE_IMAGE);
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });
}

// Covers docs/phases/phase-8-collaboration-split-view.md's split-view exit
// criteria: two references side by side, each with its own pan/zoom, tools
// acting on whichever pane is focused, Wide breakpoint only.
test.describe('at the Wide breakpoint', () => {
  test.use({ viewport: { width: 1400, height: 800 } });

  async function openTwoReferencesSplit(page: Page) {
    await page.goto('/');
    await importViaNewReference(page); // A
    await page.getByRole('button', { name: 'Add reference' }).click();
    await importViaNewReference(page); // B (focused)
    await expect(page.getByRole('tab')).toHaveCount(2);
    await page.getByRole('button', { name: /beside$/ }).click();
    await expect(page.getByTestId('split-pane-left')).toBeVisible();
  }

  test('opens a second reference beside the focused one', async ({ page }) => {
    await openTwoReferencesSplit(page);
    await expect(page.getByTestId('split-pane-left')).toHaveAttribute('data-focused', 'true');
    await expect(page.getByTestId('split-pane-right')).toHaveAttribute('data-focused', 'false');
    await expect(page.locator('canvas')).toHaveCount(6);
    // Both references are already shown, so neither offers "Split" again.
    await expect(page.getByRole('button', { name: /beside$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Close split' })).toBeVisible();
  });

  test('each pane keeps its own pan/zoom', async ({ page }) => {
    await openTwoReferencesSplit(page);
    const left = page.getByTestId('split-pane-left');
    const right = page.getByTestId('split-pane-right');
    await page.waitForTimeout(400);
    const leftBefore = await left.screenshot();
    const rightBefore = await right.screenshot();

    const box = await right.boundingBox();
    if (!box) throw new Error('right pane has no bounding box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -600);
    await page.waitForTimeout(400);

    expect((await left.screenshot()).equals(leftBefore)).toBe(true);
    expect((await right.screenshot()).equals(rightBefore)).toBe(false);
  });

  test('tools act on the focused pane, and focus swaps on click', async ({ page }) => {
    await openTwoReferencesSplit(page);
    const left = page.getByTestId('split-pane-left');
    const right = page.getByTestId('split-pane-right');

    // Focus the right pane (reference A) and annotate it. Click clear of the floating
    // rail (left) and tab strip (top), which sit over the panes' corners.
    await right.click({ position: { x: 200, y: 400 } });
    await expect(right).toHaveAttribute('data-focused', 'true');
    await expect(left).toHaveAttribute('data-focused', 'false');
    await expect(page.getByRole('tab').first()).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('button', { name: 'Draw', exact: true }).click();
    const { x: cx, y: cy } = await visibleCentre(right);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy + 40, { steps: 5 });
    await page.mouse.up();
    await expect(page.getByRole('button', { name: 'Undo last' })).toBeEnabled();

    // Focus the left pane (reference B): it has no annotations of its own.
    await left.click({ position: { x: 200, y: 400 } });
    await expect(left).toHaveAttribute('data-focused', 'true');
    await expect(page.getByRole('button', { name: 'Undo last' })).toBeDisabled();

    // And back: A's annotation is still there, on the pane it was drawn in.
    await right.click({ position: { x: 200, y: 400 } });
    await expect(page.getByRole('button', { name: 'Undo last' })).toBeEnabled();
  });

  test('closing the split, or a tab, returns to a single pane', async ({ page }) => {
    await openTwoReferencesSplit(page);
    await page.getByRole('button', { name: 'Close split' }).click();
    await expect(page.getByTestId('split-pane-left')).toHaveCount(0);
    await expect(page.getByRole('tab')).toHaveCount(2);

    // Re-open, then close the focused reference's tab: the split collapses
    // and the other reference becomes the single, focused one.
    await page.getByRole('button', { name: /beside$/ }).click();
    await expect(page.getByTestId('split-pane-left')).toBeVisible();
    await page.getByRole('button', { name: /^Close (?!split)/ }).last().click();
    await expect(page.getByTestId('split-pane-left')).toHaveCount(0);
    await expect(page.getByRole('tab')).toHaveCount(1);
    await expect(page.locator('canvas')).toHaveCount(3);
  });
});

test('Compact never shows a split', async ({ page }) => {
  await page.goto('/');
  await importViaNewReference(page);
  await expect(page.getByTestId('split-pane-left')).toHaveCount(0);
});
