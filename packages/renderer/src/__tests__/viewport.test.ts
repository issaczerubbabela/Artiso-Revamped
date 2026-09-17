import { describe, expect, it } from 'vitest';
import { Viewport } from '../viewport';

describe('Viewport', () => {
  it('fits content to the container on construction', () => {
    const viewport = new Viewport(800, 600, 1600, 1200);
    expect(viewport.getState().scale).toBeCloseTo(0.5);
  });

  it('centers content when the aspect ratio differs from the container', () => {
    // 1000x500 container, 1000x1000 (square) content: scale is capped by the
    // shorter container dimension (height), leaving letterboxing on the
    // sides -- (1000 - 1000*0.5)/2 = 250px on each side, none top/bottom.
    const viewport = new Viewport(1000, 500, 1000, 1000);
    const state = viewport.getState();
    expect(state.scale).toBeCloseTo(0.5);
    expect(state.translateX).toBeCloseTo(250);
    expect(state.translateY).toBeCloseTo(0);
  });

  it('round-trips screenToImage/imageToScreen', () => {
    const viewport = new Viewport(800, 600, 1600, 1200);
    const screenPoint = { x: 400, y: 300 };
    const imagePoint = viewport.screenToImage(screenPoint);
    expect(viewport.imageToScreen(imagePoint)).toEqual(screenPoint);
  });

  it('keeps the anchor point fixed on screen when zooming', () => {
    const viewport = new Viewport(800, 600, 1600, 1200);
    const anchor = { x: 200, y: 150 };
    const imageUnderAnchorBefore = viewport.screenToImage(anchor);
    viewport.setZoom(2, anchor);
    const imageUnderAnchorAfter = viewport.screenToImage(anchor);
    expect(imageUnderAnchorAfter.x).toBeCloseTo(imageUnderAnchorBefore.x);
    expect(imageUnderAnchorAfter.y).toBeCloseTo(imageUnderAnchorBefore.y);
    expect(viewport.getState().scale).toBe(2);
  });

  it('clamps zoom to the min/max scale range', () => {
    const viewport = new Viewport(800, 600, 1600, 1200);
    viewport.setZoom(1000);
    expect(viewport.getState().scale).toBeLessThanOrEqual(32);
    viewport.setZoom(0.0001);
    expect(viewport.getState().scale).toBeGreaterThanOrEqual(0.05);
  });

  it('pans by exactly the given screen-space delta', () => {
    const viewport = new Viewport(800, 600, 1600, 1200);
    const before = viewport.getState();
    viewport.panBy(10, -20);
    const after = viewport.getState();
    expect(after.translateX).toBeCloseTo(before.translateX + 10);
    expect(after.translateY).toBeCloseTo(before.translateY - 20);
    expect(after.scale).toBe(before.scale);
  });

  it('zoomToFit and reset restore the fitted scale after zooming/panning', () => {
    const viewport = new Viewport(800, 600, 1600, 1200);
    const fitted = viewport.getState();
    viewport.setZoom(5, { x: 100, y: 100 });
    viewport.panBy(50, 50);
    viewport.reset();
    expect(viewport.getState()).toEqual(fitted);
  });

  it('preserves the centered image region across a resize', () => {
    const viewport = new Viewport(800, 600, 1600, 1200);
    const centerImageBefore = viewport.screenToImage({ x: 400, y: 300 });
    viewport.resize(1000, 700);
    const centerImageAfter = viewport.screenToImage({ x: 500, y: 350 });
    expect(centerImageAfter.x).toBeCloseTo(centerImageBefore.x);
    expect(centerImageAfter.y).toBeCloseTo(centerImageBefore.y);
  });
});
