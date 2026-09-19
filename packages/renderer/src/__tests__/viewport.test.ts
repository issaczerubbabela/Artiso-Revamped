import { describe, expect, it } from 'vitest';
import { cropFromView, frameInViewport } from '@artiso/core-engine';
import { createCropConstraint } from '../crop-constraint';
import { Viewport, type ViewportOptions } from '../viewport';

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

  it('clamps zoom to the default min/max scale range', () => {
    const viewport = new Viewport(800, 600, 1600, 1200);
    viewport.setZoom(1000);
    expect(viewport.getState().scale).toBe(32);
    viewport.setZoom(0.0001);
    expect(viewport.getState().scale).toBe(0.05);
  });

  it('pans by exactly the given screen-space delta when unconstrained', () => {
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
    viewport.setZoom(2); // no longer showing the whole content
    const centerImageBefore = viewport.screenToImage({ x: 400, y: 300 });
    viewport.resize(1000, 700);
    const centerImageAfter = viewport.screenToImage({ x: 500, y: 350 });
    expect(centerImageAfter.x).toBeCloseTo(centerImageBefore.x);
    expect(centerImageAfter.y).toBeCloseTo(centerImageBefore.y);
    expect(viewport.getState().scale).toBe(2);
  });

  it('keeps showing the whole content across a resize when it was fitted', () => {
    const viewport = new Viewport(800, 600, 1600, 1200);
    viewport.resize(1000, 700);
    expect(viewport.getState().scale).toBeCloseTo(Math.min(1000 / 1600, 700 / 1200), 12);
  });
});

// The drawing view: content is the paper in mm, so `scale` is CSS px per mm.
// A4 portrait in a 1000 x 800 container.
const DRAW: ViewportOptions = { minScale: 'fit', maxScale: 30, panSlack: 48, fitPadding: 16 };
const A4 = { width: 210, height: 297 };
const drawViewport = (width = 1000, height = 800, paper = A4) =>
  new Viewport(width, height, paper.width, paper.height, DRAW);

describe('Viewport as the paper view (min zoom = fit, clamped pan)', () => {
  it('fits the paper with the padding kept clear', () => {
    const state = drawViewport().getState();
    // Height-limited: (800 - 32) / 297.
    expect(state.scale).toBeCloseTo((800 - 32) / 297, 12);
    expect(state.translateX).toBeCloseTo((1000 - 210 * state.scale) / 2, 9);
    expect(state.translateY).toBeCloseTo((800 - 297 * state.scale) / 2, 9);
  });

  it('never zooms out past fit', () => {
    const viewport = drawViewport();
    const fit = viewport.getState().scale;
    viewport.setZoom(0.01);
    expect(viewport.getState().scale).toBeCloseTo(fit, 12);
    viewport.setZoom(fit / 2, { x: 100, y: 100 });
    expect(viewport.getState().scale).toBeCloseTo(fit, 12);
  });

  it('caps the zoom', () => {
    const viewport = drawViewport();
    viewport.setZoom(1000);
    expect(viewport.getState().scale).toBe(30);
  });

  it('centres the paper on an axis where it is smaller than the container', () => {
    const viewport = drawViewport();
    const fitted = viewport.getState();
    viewport.panBy(120, -80);
    expect(viewport.getState()).toEqual(fitted);
  });

  it('lets a zoomed-in view pan until the paper edge is `slack` px inside the container', () => {
    const viewport = drawViewport();
    viewport.setZoom(10); // paper is 2100 x 2970 px: bigger than the container both ways
    viewport.panBy(1e6, 1e6);
    expect(viewport.getState().translateX).toBe(48);
    expect(viewport.getState().translateY).toBe(48);
    viewport.panBy(-1e6, -1e6);
    expect(viewport.getState().translateX).toBe(1000 - 2100 - 48);
    expect(viewport.getState().translateY).toBe(800 - 2970 - 48);
  });

  it('leaves a pan inside those bounds alone', () => {
    const viewport = drawViewport();
    viewport.setZoom(10);
    viewport.panBy(-300, -300);
    const before = viewport.getState();
    viewport.panBy(25, -40);
    expect(viewport.getState().translateX).toBeCloseTo(before.translateX + 25, 9);
    expect(viewport.getState().translateY).toBeCloseTo(before.translateY - 40, 9);
  });

  it('keeps the point under the anchor fixed while zooming (not blocked by the pan limits)', () => {
    const viewport = drawViewport();
    viewport.setZoom(8);
    viewport.panBy(-200, -300);
    const anchor = { x: 500, y: 400 };
    const mmBefore = viewport.screenToImage(anchor);
    viewport.setZoom(12, anchor);
    const mmAfter = viewport.screenToImage(anchor);
    expect(mmAfter.x).toBeCloseTo(mmBefore.x, 9);
    expect(mmAfter.y).toBeCloseTo(mmBefore.y, 9);
  });

  it('keeps showing the whole paper when the container is resized while fitted', () => {
    const viewport = drawViewport();
    viewport.resize(600, 1000);
    expect(viewport.getState().scale).toBeCloseTo(Math.min((600 - 32) / 210, (1000 - 32) / 297), 12);
  });

  it('keeps the same paper region centred when a zoomed view is resized', () => {
    const viewport = drawViewport();
    viewport.setZoom(6);
    const centreBefore = viewport.screenToImage({ x: 500, y: 400 });
    viewport.resize(1200, 900);
    const centreAfter = viewport.screenToImage({ x: 600, y: 450 });
    expect(centreAfter.x).toBeCloseTo(centreBefore.x, 9);
    expect(centreAfter.y).toBeCloseTo(centreBefore.y, 9);
  });

  it('re-fits when the paper itself changes size (e.g. portrait to landscape)', () => {
    const viewport = drawViewport();
    viewport.setContentSize(297, 210);
    expect(viewport.getState().scale).toBeCloseTo(Math.min((1000 - 32) / 297, (800 - 32) / 210), 12);
  });
});

describe('Viewport real size (1:1)', () => {
  const REAL = 3.7795; // 96 ppi at devicePixelRatio 1, in CSS px per mm

  it('reports failure until it has been calibrated', () => {
    const viewport = drawViewport();
    expect(viewport.getRealScale()).toBeNull();
    expect(viewport.setRealSize()).toBe(false);
    expect(viewport.isRealSize()).toBe(false);
  });

  it('zooms to the real scale about the viewport centre', () => {
    const viewport = drawViewport();
    viewport.setRealScale(REAL);
    const centreMmBefore = viewport.screenToImage({ x: 500, y: 400 });
    expect(viewport.setRealSize()).toBe(true);
    expect(viewport.getState().scale).toBeCloseTo(REAL, 12);
    expect(viewport.isRealSize()).toBe(true);
    const centreMmAfter = viewport.screenToImage({ x: 500, y: 400 });
    expect(centreMmAfter.x).toBeCloseTo(centreMmBefore.x, 9);
    expect(centreMmAfter.y).toBeCloseTo(centreMmBefore.y, 9);
  });

  it('is no longer real size after zooming or fitting', () => {
    const viewport = drawViewport();
    viewport.setRealScale(REAL);
    viewport.setRealSize();
    viewport.setZoom(REAL * 1.5);
    expect(viewport.isRealSize()).toBe(false);
    viewport.setRealSize();
    viewport.zoomToFit();
    expect(viewport.isRealSize()).toBe(false);
  });

  it('can reach real size even when it is below the fit zoom (a small sheet on a big screen)', () => {
    // A5 on a 1600 x 1200 container fits at ~5.6 px/mm, above real size (3.78).
    const viewport = drawViewport(1600, 1200, { width: 148, height: 210 });
    const fit = viewport.getState().scale;
    expect(fit).toBeGreaterThan(REAL);
    viewport.setRealScale(REAL);
    expect(viewport.setRealSize()).toBe(true);
    expect(viewport.getState().scale).toBeCloseTo(REAL, 12);
    // ...and the minimum zoom is now the real size, not fit.
    viewport.setZoom(0.01);
    expect(viewport.getState().scale).toBeCloseTo(REAL, 12);
  });

  it('still floors at fit when real size is larger than fit', () => {
    const viewport = drawViewport();
    const fit = viewport.getState().scale;
    viewport.setRealScale(REAL); // A4 fits at ~2.6 px/mm, below real size
    viewport.setZoom(0.01);
    expect(viewport.getState().scale).toBeCloseTo(fit, 12);
  });

  it('forgets the calibration when cleared', () => {
    const viewport = drawViewport();
    viewport.setRealScale(REAL);
    viewport.setRealScale(null);
    expect(viewport.getRealScale()).toBeNull();
    expect(viewport.setRealSize()).toBe(false);
  });
});

describe('Viewport with the crop tool constraint (image under a fixed frame)', () => {
  const IMG = { width: 4000, height: 3000 };
  const A4_ASPECT = 210 / 297;

  function cropViewport() {
    const container = { width: 900, height: 700 };
    const frame = frameInViewport(container.width, container.height, A4_ASPECT, 40);
    const viewport = new Viewport(container.width, container.height, IMG.width, IMG.height);
    viewport.setConstraint(createCropConstraint(IMG.width, IMG.height, frame));
    return { viewport, frame };
  }

  const visibleCrop = (viewport: Viewport, frame: ReturnType<typeof frameInViewport>) => {
    const s = viewport.getState();
    return cropFromView({ scale: s.scale, tx: s.translateX, ty: s.translateY }, frame);
  };

  it('never zooms out past "the image just covers the frame"', () => {
    const { viewport, frame } = cropViewport();
    viewport.setZoom(0.0001);
    // Height-limited: the frame is taller relative to the image than it is wide.
    expect(viewport.getState().scale).toBeCloseTo(Math.max(frame.w / IMG.width, frame.h / IMG.height), 12);
  });

  it('always keeps the frame fully inside the image, however far it is dragged', () => {
    const { viewport, frame } = cropViewport();
    viewport.setZoom(viewport.getState().scale * 3);
    for (const [dx, dy] of [
      [1e6, 1e6],
      [-1e6, -1e6],
      [1e6, -1e6],
      [-1e6, 1e6],
    ] as const) {
      viewport.panBy(dx, dy);
      const crop = visibleCrop(viewport, frame);
      expect(crop.x).toBeGreaterThanOrEqual(-1e-6);
      expect(crop.y).toBeGreaterThanOrEqual(-1e-6);
      expect(crop.x + crop.w).toBeLessThanOrEqual(IMG.width + 1e-6);
      expect(crop.y + crop.h).toBeLessThanOrEqual(IMG.height + 1e-6);
    }
  });

  it('keeps the crop at the paper aspect at every zoom', () => {
    const { viewport, frame } = cropViewport();
    for (const factor of [1, 1.7, 4, 9]) {
      viewport.setZoom(viewport.getState().scale * factor);
      const crop = visibleCrop(viewport, frame);
      expect(crop.w / crop.h).toBeCloseTo(A4_ASPECT, 9);
    }
  });

  it('keeps the point under the cursor fixed while zooming inside the limits', () => {
    const { viewport } = cropViewport();
    viewport.setZoom(viewport.getState().scale * 4);
    const anchor = { x: 450, y: 350 };
    const before = viewport.screenToImage(anchor);
    viewport.setZoom(viewport.getState().scale * 1.5, anchor);
    const after = viewport.screenToImage(anchor);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('caps the zoom at 16x cover', () => {
    const { viewport, frame } = cropViewport();
    const min = Math.max(frame.w / IMG.width, frame.h / IMG.height);
    viewport.setZoom(1e9);
    expect(viewport.getState().scale).toBeCloseTo(min * 16, 9);
  });

  it('restores the default limits when the constraint is removed', () => {
    const { viewport } = cropViewport();
    viewport.setConstraint(null);
    viewport.setZoom(0.0001);
    expect(viewport.getState().scale).toBe(0.05);
  });
});
