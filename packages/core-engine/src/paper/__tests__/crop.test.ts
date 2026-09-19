import { describe, expect, it } from 'vitest';
import {
  MAX_CROP_ZOOM,
  clampCrop,
  clampImageToFrame,
  coverScale,
  cropFromView,
  frameInViewport,
  initialCrop,
  recenterCrop,
  viewFromCrop,
} from '../crop';

const A4_PORTRAIT = 210 / 297;
const A4_LANDSCAPE = 297 / 210;

function aspectOf(r: { w: number; h: number }): number {
  return r.w / r.h;
}

describe('initialCrop', () => {
  it('is the largest centred rectangle of the aspect that fits (wide image, portrait paper)', () => {
    const crop = initialCrop(3000, 2000, A4_PORTRAIT);
    expect(crop.h).toBeCloseTo(2000, 9);
    expect(aspectOf(crop)).toBeCloseTo(A4_PORTRAIT, 12);
    expect(crop.x + crop.w / 2).toBeCloseTo(1500, 9);
    expect(crop.y).toBeCloseTo(0, 9);
  });

  it('is the largest centred rectangle of the aspect that fits (tall image, landscape paper)', () => {
    const crop = initialCrop(2000, 3000, A4_LANDSCAPE);
    expect(crop.w).toBeCloseTo(2000, 9);
    expect(aspectOf(crop)).toBeCloseTo(A4_LANDSCAPE, 12);
    expect(crop.y + crop.h / 2).toBeCloseTo(1500, 9);
    expect(crop.x).toBeCloseTo(0, 9);
  });

  it('returns the whole image when the aspects already match', () => {
    expect(initialCrop(2100, 2970, A4_PORTRAIT)).toEqual({ x: 0, y: 0, w: 2100, h: expect.closeTo(2970, 6) });
  });
});

describe('clampCrop', () => {
  it('leaves a crop that is already inside untouched', () => {
    const crop = { x: 100, y: 200, w: 400, h: 300 };
    expect(clampCrop(crop, 1000, 1000)).toEqual(crop);
  });

  it('slides a crop that hangs off the edges back inside without resizing it', () => {
    expect(clampCrop({ x: -50, y: 900, w: 400, h: 300 }, 1000, 1000)).toEqual({ x: 0, y: 700, w: 400, h: 300 });
    expect(clampCrop({ x: 800, y: -10, w: 400, h: 300 }, 1000, 1000)).toEqual({ x: 600, y: 0, w: 400, h: 300 });
  });

  it('shrinks an oversized crop to the image, keeping its aspect', () => {
    const clamped = clampCrop({ x: 0, y: 0, w: 4000, h: 2000 }, 1000, 1000);
    expect(clamped.w).toBeCloseTo(1000, 9);
    expect(aspectOf(clamped)).toBeCloseTo(2, 12);
    expect(clamped.y + clamped.h).toBeLessThanOrEqual(1000 + 1e-9);
  });
});

describe('recenterCrop', () => {
  it('turns a portrait crop into a landscape one about the same centre', () => {
    const portrait = { x: 500, y: 300, w: 1000, h: 1414.2857142857142 };
    const centre = { x: portrait.x + portrait.w / 2, y: portrait.y + portrait.h / 2 };
    const landscape = recenterCrop(portrait, A4_LANDSCAPE, 4000, 4000);
    expect(aspectOf(landscape)).toBeCloseTo(A4_LANDSCAPE, 10);
    expect(landscape.x + landscape.w / 2).toBeCloseTo(centre.x, 6);
    expect(landscape.y + landscape.h / 2).toBeCloseTo(centre.y, 6);
    // Same area, so w and h simply swap for an exact orientation flip.
    expect(landscape.w).toBeCloseTo(portrait.h, 6);
    expect(landscape.h).toBeCloseTo(portrait.w, 6);
  });

  it('re-clamps into the image when the swapped crop no longer fits', () => {
    // A tall crop hugging the left edge of a short, wide image.
    const crop = { x: 0, y: 0, w: 700, h: 1000 };
    const swapped = recenterCrop(crop, 1000 / 700, 1500, 1000);
    expect(swapped.x).toBeGreaterThanOrEqual(0);
    expect(swapped.y).toBeGreaterThanOrEqual(0);
    expect(swapped.x + swapped.w).toBeLessThanOrEqual(1500 + 1e-9);
    expect(swapped.y + swapped.h).toBeLessThanOrEqual(1000 + 1e-9);
    expect(aspectOf(swapped)).toBeCloseTo(1000 / 700, 10);
  });

  it('shrinks to fit when the target aspect cannot hold the same area', () => {
    const crop = { x: 0, y: 0, w: 1000, h: 1000 };
    const wide = recenterCrop(crop, 4, 1000, 1000);
    expect(wide.w).toBeLessThanOrEqual(1000 + 1e-9);
    expect(wide.h).toBeLessThanOrEqual(1000 + 1e-9);
    expect(aspectOf(wide)).toBeCloseTo(4, 10);
  });
});

describe('frameInViewport', () => {
  it('fits the aspect inside the viewport minus the margin, centred', () => {
    const frame = frameInViewport(1000, 800, A4_PORTRAIT, 40);
    expect(frame.h).toBeCloseTo(720, 9);
    expect(aspectOf(frame)).toBeCloseTo(A4_PORTRAIT, 12);
    expect(frame.x + frame.w / 2).toBeCloseTo(500, 9);
    expect(frame.y + frame.h / 2).toBeCloseTo(400, 9);
  });

  it('is width-limited for a landscape frame in a narrow viewport', () => {
    const frame = frameInViewport(400, 800, A4_LANDSCAPE, 20);
    expect(frame.w).toBeCloseTo(360, 9);
    expect(aspectOf(frame)).toBeCloseTo(A4_LANDSCAPE, 12);
  });

  it('never returns a non-positive frame in a tiny viewport', () => {
    const frame = frameInViewport(10, 10, 1, 40);
    expect(frame.w).toBeGreaterThan(0);
    expect(frame.h).toBeGreaterThan(0);
  });
});

describe('clampImageToFrame', () => {
  const IMG = { w: 3000, h: 2000 };
  const frame = { x: 100, y: 50, w: 400, h: 600 };

  it('raises the zoom to at least cover the frame', () => {
    const min = coverScale(IMG.w, IMG.h, frame);
    expect(min).toBeCloseTo(0.3, 12); // height-limited: 600 / 2000
    const view = clampImageToFrame({ scale: 0.01, tx: 0, ty: 0 }, IMG.w, IMG.h, frame);
    expect(view.scale).toBeCloseTo(min, 12);
  });

  it('caps the zoom', () => {
    const min = coverScale(IMG.w, IMG.h, frame);
    const view = clampImageToFrame({ scale: 1000, tx: 0, ty: 0 }, IMG.w, IMG.h, frame);
    expect(view.scale).toBeCloseTo(min * MAX_CROP_ZOOM, 9);
  });

  it('clamps the pan so every frame edge stays inside the image', () => {
    for (const [tx, ty] of [
      [9999, 9999],
      [-9999, -9999],
      [9999, -9999],
      [-9999, 9999],
    ] as const) {
      const view = clampImageToFrame({ scale: 0.5, tx, ty }, IMG.w, IMG.h, frame);
      const crop = cropFromView(view, frame);
      expect(crop.x).toBeGreaterThanOrEqual(-1e-9);
      expect(crop.y).toBeGreaterThanOrEqual(-1e-9);
      expect(crop.x + crop.w).toBeLessThanOrEqual(IMG.w + 1e-9);
      expect(crop.y + crop.h).toBeLessThanOrEqual(IMG.h + 1e-9);
    }
  });

  it('leaves a valid view alone', () => {
    const view = { scale: 0.5, tx: -200, ty: -100 };
    expect(clampImageToFrame(view, IMG.w, IMG.h, frame)).toEqual(view);
  });
});

describe('cropFromView / viewFromCrop', () => {
  const frame = { x: 120, y: 60, w: 300, h: 420 };

  it('round-trips a crop through the view', () => {
    const crop = { x: 400, y: 250, w: 900, h: 1260 };
    const back = cropFromView(viewFromCrop(crop, frame), frame);
    expect(back.x).toBeCloseTo(crop.x, 9);
    expect(back.y).toBeCloseTo(crop.y, 9);
    expect(back.w).toBeCloseTo(crop.w, 9);
    expect(back.h).toBeCloseTo(crop.h, 9);
  });

  it('keeps the frame aspect in the crop it reads', () => {
    const crop = cropFromView({ scale: 0.7, tx: -50, ty: -20 }, frame);
    expect(aspectOf(crop)).toBeCloseTo(frame.w / frame.h, 12);
  });

  it('maps the frame corners to the crop corners', () => {
    const view = { scale: 0.5, tx: -100, ty: -40 };
    const crop = cropFromView(view, frame);
    // screen = image * scale + t  ->  image = (screen - t) / scale
    expect(crop.x * view.scale + view.tx).toBeCloseTo(frame.x, 9);
    expect((crop.y + crop.h) * view.scale + view.ty).toBeCloseTo(frame.y + frame.h, 9);
  });
});
