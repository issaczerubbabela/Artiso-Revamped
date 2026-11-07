import { describe, expect, it } from 'vitest';
import { Viewport, type Point, type ViewportOptions } from '../viewport';

// Cell Focus auto-pan: stepping to a cell that is off screen pans just enough
// to show it, at the same zoom and angle, with no glide; a cell already in view
// leaves the view alone.

const DRAW: ViewportOptions = { minScale: 'fit', maxScale: 30, panSlack: 48, fitPadding: 16 };
const A4 = { width: 210, height: 297 };
const MARGIN = 16;

function zoomedIn(rotation = 0): Viewport {
  const viewport = new Viewport(1000, 800, A4.width, A4.height, DRAW);
  // 10 px/mm: the paper is 2100 x 2970 px, far bigger than the screen.
  viewport.setState({ scale: 10, translateX: -500, translateY: -1000, rotation });
  return viewport;
}

function screenCorners(viewport: Viewport, rect: { x: number; y: number; w: number; h: number }): Point[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
  ].map((p) => viewport.imageToScreen(p));
}

function expectInside(points: Point[], region: { left: number; top: number; right: number; bottom: number }): void {
  for (const p of points) {
    expect(p.x).toBeGreaterThanOrEqual(region.left - 1e-6);
    expect(p.x).toBeLessThanOrEqual(region.right + 1e-6);
    expect(p.y).toBeGreaterThanOrEqual(region.top - 1e-6);
    expect(p.y).toBeLessThanOrEqual(region.bottom + 1e-6);
  }
}

describe('Viewport.revealRect', () => {
  it('leaves the view alone when the rect is already fully visible', () => {
    const viewport = zoomedIn();
    const before = viewport.getState();
    // Content (60..85, 110..135) is at screen (100..350, 100..350).
    expect(viewport.revealRect({ x: 60, y: 110, w: 25, h: 25 }, MARGIN)).toBe(false);
    expect(viewport.getState()).toEqual(before);
  });

  it('does not nudge a visible rect that merely sits inside the margin', () => {
    const viewport = zoomedIn();
    const before = viewport.getState();
    // Screen x 5..255: on screen, just closer to the edge than the margin.
    expect(viewport.revealRect({ x: 50.5, y: 110, w: 25, h: 25 }, MARGIN)).toBe(false);
    expect(viewport.getState()).toEqual(before);
  });

  it('pans just far enough to bring an off-screen rect in past the margin', () => {
    const viewport = zoomedIn();
    const before = viewport.getState();
    // Screen x 1250..1500: off the right edge.
    expect(viewport.revealRect({ x: 175, y: 110, w: 25, h: 25 }, MARGIN)).toBe(true);
    const after = viewport.getState();
    expect(after.scale).toBe(before.scale);
    expect(after.rotation).toBe(before.rotation);
    expect(after.translateY).toBe(before.translateY);
    const corners = screenCorners(viewport, { x: 175, y: 110, w: 25, h: 25 });
    expect(Math.max(...corners.map((p) => p.x))).toBeCloseTo(1000 - MARGIN);
  });

  it('pans the least distance for a partly visible rect above the view', () => {
    const viewport = zoomedIn();
    // Screen y -50..200: cut by the top edge.
    expect(viewport.revealRect({ x: 60, y: 95, w: 25, h: 25 }, MARGIN)).toBe(true);
    const corners = screenCorners(viewport, { x: 60, y: 95, w: 25, h: 25 });
    expect(Math.min(...corners.map((p) => p.y))).toBeCloseTo(MARGIN);
  });

  it('keeps clear of the chrome insets', () => {
    const viewport = zoomedIn();
    viewport.setInsets({ left: 80, bottom: 120 });
    // Screen y 650..900: under the bottom chrome.
    const rect = { x: 60, y: 165, w: 25, h: 25 };
    expect(viewport.revealRect(rect, MARGIN)).toBe(true);
    expectInside(screenCorners(viewport, rect), { left: 80, top: 0, right: 1000, bottom: 800 - 120 - MARGIN });
  });

  it('works at any View Rotation: the turned cell ends up wholly on screen', () => {
    for (const rotation of [0.4, Math.PI / 2, -2.2]) {
      const viewport = zoomedIn(rotation);
      const rect = { x: 175, y: 260, w: 25, h: 25 };
      viewport.revealRect(rect, MARGIN);
      expect(viewport.getState().rotation).toBe(rotation);
      expect(viewport.getState().scale).toBe(10);
      expectInside(screenCorners(viewport, rect), { left: MARGIN, top: MARGIN, right: 1000 - MARGIN, bottom: 800 - MARGIN });
    }
  });

  it('centres a rect bigger than the visible region', () => {
    const viewport = zoomedIn();
    const rect = { x: 0, y: 0, w: 150, h: 25 };
    viewport.revealRect(rect, MARGIN);
    const corners = screenCorners(viewport, rect);
    const minX = Math.min(...corners.map((p) => p.x));
    const maxX = Math.max(...corners.map((p) => p.x));
    expect((minX + maxX) / 2).toBeCloseTo(500);
  });
});
