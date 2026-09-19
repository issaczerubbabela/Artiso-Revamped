import type { Locator, Page } from '@playwright/test';

// The canvas is full-bleed underneath floating chrome, so the canvas element's own
// bounding box is no longer where the photo is: on Compact the bottom sheet covers
// its middle, on Wide the dock covers its right. PaneStage publishes how much of
// itself the chrome covers (data-inset-*, in CSS px); this is the centre of what is
// left, i.e. a point that is really on the visible photo.
export async function visibleCentre(scope: Page | Locator): Promise<{ x: number; y: number }> {
  const pane = scope.locator('[data-testid="pane"]').first();
  const box = await pane.boundingBox();
  if (!box) throw new Error('pane has no bounding box');
  const inset = async (edge: 'left' | 'top' | 'right' | 'bottom') => Number((await pane.getAttribute(`data-inset-${edge}`)) ?? 0);
  const [left, top, right, bottom] = await Promise.all([inset('left'), inset('top'), inset('right'), inset('bottom')]);
  return {
    x: box.x + left + (box.width - left - right) / 2,
    y: box.y + top + (box.height - top - bottom) / 2,
  };
}
