import { describe, expect, it } from 'vitest';
import {
  LEGACY_VIEW_ROTATION_KEY,
  ORIENTATION_VIEWS_KEY,
  loadOrientationViews,
  migrateViewRotations,
  parseOrientationViews,
  rememberView,
  viewOrientation,
} from '../orientation-views';
import { Viewport, type ViewportOptions } from '../viewport';

// Landscape and portrait each remember their own zoom, pan and View Rotation per
// reference, on this device only (issue #10). The single per-reference angle the
// app stored before is migrated into both slots.

const deg = (d: number) => (d * Math.PI) / 180;

describe('viewOrientation', () => {
  it('is landscape only when the viewport is wider than tall', () => {
    expect(viewOrientation(1180, 820)).toBe('landscape');
    expect(viewOrientation(820, 1180)).toBe('portrait');
    expect(viewOrientation(800, 800)).toBe('portrait');
  });
});

describe('migrateViewRotations: the single angle to the orientation slots', () => {
  it('copies each reference angle into both slots, with no zoom or pan (so each fits)', () => {
    expect(migrateViewRotations({ a: deg(30), b: -deg(90) })).toEqual({
      a: { landscape: { rotation: deg(30) }, portrait: { rotation: deg(30) } },
      b: { landscape: { rotation: -deg(90) }, portrait: { rotation: -deg(90) } },
    });
  });

  it('normalizes angles and drops anything that is not a finite number', () => {
    const migrated = migrateViewRotations({ a: 3 * Math.PI, b: 'x', c: Number.NaN, d: null });
    expect(Object.keys(migrated)).toEqual(['a']);
    expect(migrated.a?.landscape?.rotation).toBeCloseTo(Math.PI, 12);
  });

  it('migrates nothing from a value that is not a map', () => {
    expect(migrateViewRotations(null)).toEqual({});
    expect(migrateViewRotations([1, 2])).toEqual({});
    expect(migrateViewRotations('0.5')).toEqual({});
  });
});

describe('loadOrientationViews', () => {
  const legacy = JSON.stringify({ ref: deg(45) });

  it('migrates the legacy angles when nothing has been stored in the new form yet', () => {
    const { views, migrated } = loadOrientationViews(null, legacy);
    expect(migrated).toBe(true);
    expect(views).toEqual({ ref: { landscape: { rotation: deg(45) }, portrait: { rotation: deg(45) } } });
  });

  it('prefers the new form once it exists, ignoring the legacy angles', () => {
    const current = JSON.stringify({ ref: { portrait: { rotation: 0.5, scale: 2, centerX: 10, centerY: 20 } } });
    const { views, migrated } = loadOrientationViews(current, legacy);
    expect(migrated).toBe(false);
    expect(views).toEqual({ ref: { portrait: { rotation: 0.5, scale: 2, centerX: 10, centerY: 20 } } });
  });

  it('starts empty from unreadable storage', () => {
    expect(loadOrientationViews('{not json', 'nope').views).toEqual({});
    expect(loadOrientationViews(null, null)).toEqual({ views: {}, migrated: false });
  });

  it('uses distinct storage keys for the two forms', () => {
    expect(ORIENTATION_VIEWS_KEY).not.toBe(LEGACY_VIEW_ROTATION_KEY);
  });
});

describe('parseOrientationViews', () => {
  it('keeps valid slots and drops malformed ones', () => {
    expect(
      parseOrientationViews({
        a: { landscape: { rotation: 0.2, scale: 3, centerX: 1, centerY: 2 }, portrait: { rotation: 'x' } },
        b: { portrait: { rotation: 0.1, scale: -1, centerX: 1, centerY: 2 } },
        c: 'junk',
      }),
    ).toEqual({
      a: { landscape: { rotation: 0.2, scale: 3, centerX: 1, centerY: 2 } },
      // A bad scale leaves just the angle: that orientation fits at it.
      b: { portrait: { rotation: 0.1 } },
    });
  });
});

describe('rememberView', () => {
  it('stores a slot without touching the other orientation', () => {
    const start = { r: { landscape: { rotation: 0.3 }, portrait: { rotation: 0.3 } } };
    const next = rememberView(start, 'r', 'portrait', { rotation: 0, scale: 4, centerX: 5, centerY: 6 });
    expect(next).toEqual({ r: { landscape: { rotation: 0.3 }, portrait: { rotation: 0, scale: 4, centerX: 5, centerY: 6 } } });
    // Immutable: the input is untouched.
    expect(start.r.portrait).toEqual({ rotation: 0.3 });
  });

  it('returns the same map when nothing changed', () => {
    const start = { r: { landscape: { rotation: 0.3 } } };
    expect(rememberView(start, 'r', 'landscape', { rotation: 0.3 })).toBe(start);
  });

  it('keeps the most recently used references, dropping the oldest past the limit', () => {
    let views = {};
    for (const id of ['a', 'b', 'c']) views = rememberView(views, id, 'landscape', { rotation: 0.1 }, 2);
    expect(Object.keys(views)).toEqual(['b', 'c']);
    views = rememberView(views, 'b', 'portrait', { rotation: 0.2 }, 2);
    views = rememberView(views, 'd', 'landscape', { rotation: 0.1 }, 2);
    expect(Object.keys(views)).toEqual(['b', 'd']);
  });
});

describe('Viewport: remembering and restoring a view', () => {
  const DRAW: ViewportOptions = { minScale: 'fit', maxScale: 30, panSlack: 48, fitPadding: 16 };

  it('remembers a fitted view as its angle only', () => {
    const viewport = new Viewport(1180, 820, 210, 297, DRAW);
    viewport.zoomToFit(deg(20));
    expect(viewport.getRememberedView()).toEqual({ rotation: deg(20) });
  });

  it('restores zoom, the point at the visible centre and the angle', () => {
    const viewport = new Viewport(1180, 820, 210, 297, DRAW);
    viewport.setScaleAndRotation(8, deg(15));
    viewport.panBy(-120, 60);
    const remembered = viewport.getRememberedView();
    const before = viewport.getState();

    viewport.resize(820, 1180);
    viewport.zoomToFit(0);
    viewport.resize(1180, 820);
    viewport.restoreView(remembered);
    const after = viewport.getState();
    expect(after.scale).toBeCloseTo(before.scale, 9);
    expect(after.rotation).toBeCloseTo(before.rotation, 12);
    expect(after.translateX).toBeCloseTo(before.translateX, 6);
    expect(after.translateY).toBeCloseTo(before.translateY, 6);
  });

  it('fits at the remembered angle when only the angle is known', () => {
    const viewport = new Viewport(820, 1180, 210, 297, DRAW);
    viewport.setZoom(10);
    viewport.restoreView({ rotation: deg(90) });
    const state = viewport.getState();
    expect(state.rotation).toBeCloseTo(deg(90), 12);
    expect(state.scale).toBeCloseTo(viewport.getFitScale(), 9);
  });

  it('keeps a restored view within the zoom limits', () => {
    const viewport = new Viewport(820, 1180, 210, 297, DRAW);
    viewport.restoreView({ rotation: 0, scale: 1000, centerX: 105, centerY: 148 });
    expect(viewport.getState().scale).toBe(30);
  });
});
