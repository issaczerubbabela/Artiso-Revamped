import { describe, expect, it } from 'vitest';
import { normalizeAngle, rubberBandScale, snapViewRotation, viewRotationDegrees } from '../view-rotation';
import { Viewport, type ViewportOptions } from '../viewport';

const deg = (d: number) => (d * Math.PI) / 180;

describe('normalizeAngle', () => {
  it('folds any angle into (-180°, 180°]', () => {
    expect(normalizeAngle(deg(370))).toBeCloseTo(deg(10), 12);
    expect(normalizeAngle(deg(-190))).toBeCloseTo(deg(170), 12);
    expect(normalizeAngle(deg(180))).toBeCloseTo(Math.PI, 12);
    expect(normalizeAngle(deg(-180))).toBeCloseTo(Math.PI, 12);
    expect(Object.is(normalizeAngle(-0), 0)).toBe(true);
    expect(normalizeAngle(Number.NaN)).toBe(0);
  });
});

describe('snapViewRotation', () => {
  it('snaps to 0°, 90°, 180° and 270° within 5°', () => {
    expect(snapViewRotation(deg(4.9))).toBe(0);
    expect(snapViewRotation(deg(-5))).toBe(0);
    expect(snapViewRotation(deg(86))).toBeCloseTo(Math.PI / 2, 12);
    expect(snapViewRotation(deg(183))).toBeCloseTo(Math.PI, 12);
    expect(snapViewRotation(deg(-177))).toBeCloseTo(Math.PI, 12);
    expect(snapViewRotation(deg(272))).toBeCloseTo(-Math.PI / 2, 12);
    expect(snapViewRotation(deg(360 + 2))).toBe(0);
  });

  it('leaves every other angle alone, 45° included', () => {
    for (const d of [5.5, 30, 45, 84, 96, 135, -45, -100]) {
      expect(snapViewRotation(deg(d))).toBeCloseTo(normalizeAngle(deg(d)), 12);
    }
  });
});

describe('viewRotationDegrees', () => {
  it('reads the angle in whole degrees, (-180, 180]', () => {
    expect(viewRotationDegrees(deg(14.6))).toBe(15);
    expect(viewRotationDegrees(deg(-14.4))).toBe(-14);
    expect(viewRotationDegrees(deg(270))).toBe(-90);
    expect(viewRotationDegrees(Math.PI)).toBe(180);
    expect(viewRotationDegrees(-Math.PI)).toBe(180);
    expect(Object.is(viewRotationDegrees(deg(-0.2)), 0)).toBe(true);
  });
});

describe('rubberBandScale', () => {
  it('is the raw scale within the limits', () => {
    expect(rubberBandScale(3, 3)).toBe(3);
  });

  it('stretches past a limit with growing resistance, never beyond ~30%', () => {
    const near = rubberBandScale(11, 10);
    expect(near).toBeGreaterThan(10);
    expect(near).toBeLessThan(11);
    const far = rubberBandScale(1000, 10);
    expect(far).toBeLessThan(13);
    expect(far).toBeGreaterThan(near);
    const under = rubberBandScale(0.01, 1);
    expect(under).toBeGreaterThan(1 / 1.3);
    expect(under).toBeLessThan(1);
  });
});

describe('Viewport: gesture transforms', () => {
  const DRAW: ViewportOptions = { minScale: 'fit', maxScale: 30, panSlack: 48, fitPadding: 16 };

  it('transformAbout carries the content under one point to another, turned and zoomed', () => {
    const viewport = new Viewport(1000, 800, 210, 297, DRAW);
    viewport.setZoom(10);
    const from = { x: 480, y: 390 };
    const under = viewport.screenToImage(from);
    viewport.transformAbout(12, deg(33), from, { x: 520, y: 410 });
    const at = viewport.imageToScreen(under);
    expect(at.x).toBeCloseTo(520, 9);
    expect(at.y).toBeCloseTo(410, 9);
    expect(viewport.getState().rotation).toBeCloseTo(deg(33), 12);
  });

  it('transformAbout can leave the scale past its limit for a rubber-band', () => {
    const viewport = new Viewport(1000, 800, 210, 297, DRAW);
    viewport.transformAbout(40, 0, { x: 500, y: 400 }, { x: 500, y: 400 }, { clampScale: false });
    expect(viewport.getState().scale).toBe(40);
    expect(viewport.clampScale(40)).toBe(30);
  });

  it('zoomToFit(0) fits and squares up a turned view', () => {
    const viewport = new Viewport(1000, 800, 210, 297, DRAW);
    viewport.setRotation(deg(40));
    viewport.zoomToFit(0);
    const straight = new Viewport(1000, 800, 210, 297, DRAW);
    expect(viewport.getState()).toEqual(straight.getState());
  });
});
