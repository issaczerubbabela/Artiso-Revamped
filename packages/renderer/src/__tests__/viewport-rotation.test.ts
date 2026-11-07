import { describe, expect, it } from 'vitest';
import { Viewport, viewMatrix, type Point, type ViewportOptions } from '../viewport';

// View Rotation (GLOSSARY.md): the viewport's transform turns the content about
// the screen, like turning a sheet of paper on a desk. These tests pin the
// rotation maths; the prefactor ships with the angle held at 0, so nothing here
// changes what the app shows yet.

const DRAW: ViewportOptions = { minScale: 'fit', maxScale: 30, panSlack: 48, fitPadding: 16 };
const A4 = { width: 210, height: 297 };
const drawViewport = (width = 1000, height = 800, paper = A4) =>
  new Viewport(width, height, paper.width, paper.height, DRAW);

const ANGLES = [0, 0.3, -1.2, Math.PI / 2, 2.5, Math.PI, -2.9, (7 * Math.PI) / 4];
const deg = (d: number) => (d * Math.PI) / 180;

function expectPointClose(actual: Point, expected: Point, digits = 9): void {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
}

// The four content corners, on screen.
function screenCorners(viewport: Viewport): Point[] {
  const { width, height } = viewport.getContentSize();
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ].map((p) => viewport.imageToScreen(p));
}

function bounds(points: Point[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

describe('Viewport rotation: the transform', () => {
  it('starts at 0°', () => {
    expect(drawViewport().getState().rotation).toBe(0);
  });

  it('turns content clockwise on screen for a positive angle (y points down)', () => {
    const viewport = new Viewport(800, 600, 100, 100, { minScale: 0.01 });
    viewport.setState({ scale: 2, translateX: 400, translateY: 300, rotation: Math.PI / 2 });
    // The content's +x axis now points down the screen.
    expectPointClose(viewport.imageToScreen({ x: 10, y: 0 }), { x: 400, y: 320 });
    // ...and its +y axis points left.
    expectPointClose(viewport.imageToScreen({ x: 0, y: 10 }), { x: 380, y: 300 });
  });

  it('round-trips screen -> content -> screen at arbitrary angles', () => {
    const viewport = drawViewport();
    viewport.setZoom(6, { x: 300, y: 250 });
    for (const angle of ANGLES) {
      viewport.setRotation(angle, { x: 410, y: 370 });
      for (const screen of [
        { x: 0, y: 0 },
        { x: 123.4, y: 567.8 },
        { x: 1000, y: 800 },
        { x: -50, y: 900 },
      ]) {
        expectPointClose(viewport.imageToScreen(viewport.screenToImage(screen)), screen);
      }
      for (const content of [
        { x: 0, y: 0 },
        { x: 105, y: 148.5 },
        { x: 210, y: 297 },
      ]) {
        expectPointClose(viewport.screenToImage(viewport.imageToScreen(content)), content);
      }
    }
  });

  it('exposes the same transform as a canvas matrix', () => {
    const viewport = drawViewport();
    viewport.setZoom(5);
    viewport.setRotation(0.7);
    const m = viewMatrix(viewport.getState());
    const p = { x: 40, y: 90 };
    expectPointClose({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f }, viewport.imageToScreen(p));
  });

  it('is the plain scale-and-translate matrix at 0°', () => {
    expect(viewMatrix({ scale: 3, translateX: 10, translateY: 20, rotation: 0 })).toEqual({
      a: 3,
      b: 0,
      c: -0,
      d: 3,
      e: 10,
      f: 20,
    });
  });
});

describe('Viewport rotation: anchoring', () => {
  it('keeps the content point under the anchor fixed while rotating', () => {
    const viewport = drawViewport();
    viewport.setZoom(8);
    const anchor = { x: 620, y: 310 };
    const under = viewport.screenToImage(anchor);
    viewport.setRotation(deg(37), anchor);
    expect(viewport.getState().rotation).toBeCloseTo(deg(37), 12);
    expectPointClose(viewport.screenToImage(anchor), under);
  });

  it('keeps the anchor fixed under combined zoom and rotation', () => {
    const viewport = drawViewport();
    viewport.setZoom(4);
    const anchor = { x: 450, y: 420 };
    for (const angle of ANGLES) {
      const under = viewport.screenToImage(anchor);
      const scale = 4 + Math.abs(angle);
      viewport.setScaleAndRotation(scale, angle, anchor);
      expect(viewport.getState().scale).toBeCloseTo(scale, 12);
      expect(viewport.getState().rotation).toBeCloseTo(angle, 12);
      expectPointClose(viewport.screenToImage(anchor), under);
    }
  });

  it('keeps the anchor fixed when zooming an already rotated view', () => {
    const viewport = drawViewport();
    viewport.setZoom(5);
    viewport.setRotation(deg(-62));
    const anchor = { x: 280, y: 520 };
    const under = viewport.screenToImage(anchor);
    viewport.setZoom(11, anchor);
    expect(viewport.getState().rotation).toBeCloseTo(deg(-62), 12);
    expectPointClose(viewport.screenToImage(anchor), under);
  });

  it('keeps the angle through a pan', () => {
    const viewport = drawViewport();
    viewport.setZoom(9);
    viewport.setRotation(1.1);
    viewport.panBy(-30, 20);
    expect(viewport.getState().rotation).toBeCloseTo(1.1, 12);
  });
});

describe('Viewport rotation: fit to screen', () => {
  it('fits the rotated bounding box, not the unrotated content', () => {
    // 400 x 200 content turned 90° is 200 wide and 400 tall on screen.
    const viewport = new Viewport(1000, 800, 400, 200, { minScale: 0.01 });
    viewport.setRotation(Math.PI / 2);
    viewport.zoomToFit();
    expect(viewport.getState().scale).toBeCloseTo(Math.min(1000 / 200, 800 / 400), 12);
    expect(viewport.getState().rotation).toBeCloseTo(Math.PI / 2, 12);
  });

  it('fits a 45° view by its diagonal extent', () => {
    const viewport = new Viewport(1000, 800, 400, 200, { minScale: 0.01 });
    viewport.setRotation(Math.PI / 4);
    viewport.zoomToFit();
    const extent = (400 + 200) * Math.SQRT1_2;
    expect(viewport.getState().scale).toBeCloseTo(Math.min(1000 / extent, 800 / extent), 12);
  });

  it('fits rotated content inside the chrome insets, centred in the uncovered region', () => {
    const viewport = drawViewport();
    viewport.setInsets({ left: 200, top: 60, right: 40, bottom: 100 });
    for (const angle of ANGLES) {
      viewport.setRotation(angle);
      viewport.zoomToFit();
      // Uncovered region: x 200..960, y 60..700; fitPadding 16 kept clear.
      const box = bounds(screenCorners(viewport));
      expect(box.minX).toBeGreaterThanOrEqual(200 + 16 - 1e-6);
      expect(box.maxX).toBeLessThanOrEqual(960 - 16 + 1e-6);
      expect(box.minY).toBeGreaterThanOrEqual(60 + 16 - 1e-6);
      expect(box.maxY).toBeLessThanOrEqual(700 - 16 + 1e-6);
      // It touches the padding on the limiting axis (it really is the *fit*).
      const touchesX = Math.abs(box.minX - 216) < 1e-6 && Math.abs(box.maxX - 944) < 1e-6;
      const touchesY = Math.abs(box.minY - 76) < 1e-6 && Math.abs(box.maxY - 684) < 1e-6;
      expect(touchesX || touchesY).toBe(true);
      // The paper's centre sits at the region's centre.
      expectPointClose(viewport.imageToScreen({ x: 105, y: 148.5 }), { x: 580, y: 380 });
    }
  });

  it('floors the zoom at the fit for the current angle', () => {
    const viewport = drawViewport();
    viewport.setRotation(Math.PI / 2);
    viewport.setZoom(0.001);
    // A4 on its side: 297 wide x 210 tall in a 1000 x 800 container.
    expect(viewport.getState().scale).toBeCloseTo(Math.min((1000 - 32) / 297, (800 - 32) / 210), 12);
    expect(viewport.getFitScale()).toBeCloseTo(Math.min((1000 - 32) / 297, (800 - 32) / 210), 12);
  });
});

describe('Viewport rotation: pan limits', () => {
  it('lets a zoomed, rotated view pan until its on-screen edge is `slack` px inside', () => {
    const viewport = drawViewport();
    viewport.setZoom(10);
    viewport.setRotation(Math.PI / 2);
    viewport.panBy(1e6, 1e6);
    let box = bounds(screenCorners(viewport));
    expect(box.minX).toBeCloseTo(48, 6);
    expect(box.minY).toBeCloseTo(48, 6);
    viewport.panBy(-1e6, -1e6);
    box = bounds(screenCorners(viewport));
    expect(box.maxX).toBeCloseTo(1000 - 48, 6);
    expect(box.maxY).toBeCloseTo(800 - 48, 6);
  });

  it('applies the same limits at an arbitrary angle, by the rotated bounding box', () => {
    const viewport = drawViewport();
    viewport.setZoom(10);
    viewport.setRotation(deg(30));
    viewport.panBy(-1e6, 1e6);
    const box = bounds(screenCorners(viewport));
    expect(box.maxX).toBeCloseTo(1000 - 48, 6);
    expect(box.minY).toBeCloseTo(48, 6);
  });

  it('centres a rotated view on an axis where it is smaller than the visible region', () => {
    const viewport = drawViewport();
    viewport.setInsets({ left: 100 });
    viewport.setRotation(deg(20));
    viewport.zoomToFit();
    const fitted = viewport.getState();
    viewport.panBy(150, -90);
    const after = viewport.getState();
    expect(after.translateX).toBeCloseTo(fitted.translateX, 9);
    expect(after.translateY).toBeCloseTo(fitted.translateY, 9);
  });

  it('leaves a pan inside the limits alone', () => {
    const viewport = drawViewport();
    viewport.setZoom(10);
    viewport.setRotation(deg(-75));
    viewport.panBy(-200, 150);
    const before = viewport.getState();
    viewport.panBy(25, -40);
    expect(viewport.getState().translateX).toBeCloseTo(before.translateX + 25, 9);
    expect(viewport.getState().translateY).toBeCloseTo(before.translateY - 40, 9);
  });
});

describe('Viewport rotation: real size (1:1)', () => {
  const REAL = 3.7795;

  it('fixes the scale only, keeping the angle and the visible centre', () => {
    const viewport = drawViewport();
    viewport.setRealScale(REAL);
    viewport.setRotation(deg(33));
    const centreBefore = viewport.screenToImage({ x: 500, y: 400 });
    expect(viewport.setRealSize()).toBe(true);
    expect(viewport.getState().scale).toBeCloseTo(REAL, 12);
    expect(viewport.getState().rotation).toBeCloseTo(deg(33), 12);
    expect(viewport.isRealSize()).toBe(true);
    expectPointClose(viewport.screenToImage({ x: 500, y: 400 }), centreBefore);
  });

  it('stays real size while the view is rotated', () => {
    const viewport = drawViewport();
    viewport.setRealScale(REAL);
    viewport.setRealSize();
    viewport.setRotation(deg(-140));
    expect(viewport.getState().scale).toBeCloseTo(REAL, 12);
    expect(viewport.isRealSize()).toBe(true);
  });
});

describe('Viewport rotation: framing is kept', () => {
  it('keeps the angle through a resize and a re-fit', () => {
    const viewport = drawViewport();
    viewport.setRotation(0.4);
    viewport.resize(1200, 700);
    expect(viewport.getState().rotation).toBeCloseTo(0.4, 12);
    viewport.zoomToFit();
    expect(viewport.getState().rotation).toBeCloseTo(0.4, 12);
  });

  it('keeps the same content centred when a rotated, zoomed view is resized', () => {
    const viewport = drawViewport();
    viewport.setZoom(6);
    viewport.setRotation(1.3);
    const centreBefore = viewport.screenToImage({ x: 500, y: 400 });
    viewport.resize(1200, 900);
    expectPointClose(viewport.screenToImage({ x: 600, y: 450 }), centreBefore);
  });
});
