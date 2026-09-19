import { describe, expect, it } from 'vitest';
import { insetsFromChrome, type ChromeRect } from '../chrome-insets';

const SCREEN = { left: 0, top: 0, right: 1280, bottom: 800 };
const GAP = 12;

const rail: ChromeRect = { edge: 'left', left: 16, top: 100, right: 88, bottom: 700 };
const dock: ChromeRect = { edge: 'right', left: 964, top: 16, right: 1264, bottom: 500 };
const topPill: ChromeRect = { edge: 'top', left: 400, top: 16, right: 800, bottom: 68 };
const bottomBar: ChromeRect = { edge: 'bottom', left: 16, top: 720, right: 1264, bottom: 784 };

describe('insetsFromChrome', () => {
  it('is all zero when no chrome is showing', () => {
    expect(insetsFromChrome(SCREEN, [], GAP)).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
  });

  it('measures each edge from the container to the far side of the panel, plus the gap', () => {
    expect(insetsFromChrome(SCREEN, [rail, dock, topPill, bottomBar], GAP)).toEqual({
      left: 88 + GAP,
      right: 1280 - (964 - GAP),
      top: 68 + GAP,
      bottom: 800 - (720 - GAP),
    });
  });

  it('takes the deepest panel when several share an edge', () => {
    const sheet: ChromeRect = { edge: 'bottom', left: 16, top: 400, right: 1264, bottom: 700 };
    expect(insetsFromChrome(SCREEN, [bottomBar, sheet], GAP).bottom).toBe(800 - (400 - GAP));
  });

  it('ignores panels that do not overlap the container (split view panes)', () => {
    const rightPane = { left: 640, top: 0, right: 1280, bottom: 800 };
    const leftPane = { left: 0, top: 0, right: 640, bottom: 800 };
    // The rail sits over the left pane only; the dock over the right pane only.
    expect(insetsFromChrome(rightPane, [rail, dock], GAP)).toMatchObject({ left: 0, right: 1280 - (964 - GAP) });
    expect(insetsFromChrome(leftPane, [rail, dock], GAP)).toMatchObject({ left: 88 + GAP - 0, right: 0 });
  });

  it('measures inward from a container that does not start at the screen origin', () => {
    const pane = { left: 640, top: 0, right: 1280, bottom: 800 };
    const overlapping: ChromeRect = { edge: 'left', left: 600, top: 0, right: 700, bottom: 800 };
    expect(insetsFromChrome(pane, [overlapping], GAP).left).toBe(700 + GAP - 640);
  });

  it('never lets chrome cover so much that less than the minimum stays visible', () => {
    const wide: ChromeRect[] = [
      { edge: 'left', left: 0, top: 0, right: 700, bottom: 800 },
      { edge: 'right', left: 500, top: 0, right: 1280, bottom: 800 },
    ];
    const { left, right } = insetsFromChrome(SCREEN, wide, GAP, 160);
    expect(left + right).toBeCloseTo(1280 - 160);
    expect(left).toBeGreaterThan(0);
    expect(right).toBeGreaterThan(0);
  });

  it('treats non-finite results as zero', () => {
    const broken: ChromeRect = { edge: 'left', left: 0, top: 0, right: Number.NaN, bottom: 800 };
    const { left } = insetsFromChrome(SCREEN, [broken], GAP);
    expect(Number.isFinite(left)).toBe(true);
  });
});
