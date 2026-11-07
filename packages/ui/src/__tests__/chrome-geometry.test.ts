import { describe, expect, it } from 'vitest';
import {
  POPOVER_ARROW_INSET_PX,
  SHEET_FLICK_SPEED,
  placeMenu,
  placePopover,
  settleSheet,
  sheetHeights,
  stepSheetDetent,
  type Rect,
} from '../chrome/geometry';

const SCREEN: Rect = { left: 16, top: 16, right: 1178, bottom: 818 };

describe('placePopover', () => {
  const anchor: Rect = { left: 30, top: 300, right: 74, bottom: 344 };

  it('opens to the right of its button with the arrow on the button centre', () => {
    const p = placePopover({ anchor, size: { width: 320, height: 200 }, bounds: SCREEN, gap: 12 });
    expect(p.side).toBe('right');
    expect(p.left).toBe(74 + 12);
    // Centred on the button.
    expect(p.top).toBe(322 - 100);
    expect(p.arrow).toBe(100);
  });

  it('stays on screen and keeps the arrow pointing at the button when clamped', () => {
    const low: Rect = { left: 30, top: 760, right: 74, bottom: 804 };
    const p = placePopover({ anchor: low, size: { width: 320, height: 300 }, bounds: SCREEN, gap: 12 });
    expect(p.top + 300).toBeLessThanOrEqual(SCREEN.bottom);
    expect(p.top + p.arrow).toBe(782);
  });

  it('never puts the arrow past the rounded corners', () => {
    const top: Rect = { left: 30, top: 10, right: 74, bottom: 20 };
    const p = placePopover({ anchor: top, size: { width: 320, height: 300 }, bounds: SCREEN, gap: 12 });
    expect(p.top).toBe(SCREEN.top);
    expect(p.arrow).toBe(POPOVER_ARROW_INSET_PX);
  });

  it('flips to the left when there is no room on the right', () => {
    const right: Rect = { left: 1100, top: 300, right: 1144, bottom: 344 };
    const p = placePopover({ anchor: right, size: { width: 320, height: 200 }, bounds: SCREEN, gap: 12 });
    expect(p.side).toBe('left');
    expect(p.left).toBe(1100 - 12 - 320);
  });

  it('shrinks to the screen when taller than it', () => {
    const p = placePopover({ anchor, size: { width: 320, height: 2000 }, bounds: SCREEN, gap: 12 });
    expect(p.top).toBe(SCREEN.top);
    expect(p.maxHeight).toBe(SCREEN.bottom - SCREEN.top);
  });
});

describe('placeMenu', () => {
  it('opens just below and right of the press, off the finger', () => {
    const m = placeMenu({ point: { x: 400, y: 300 }, size: { width: 220, height: 160 }, bounds: SCREEN, offset: 8 });
    expect(m).toEqual({ left: 408, top: 308 });
  });

  it('flips up and left near the bottom-right corner', () => {
    const m = placeMenu({ point: { x: 1150, y: 800 }, size: { width: 220, height: 160 }, bounds: SCREEN, offset: 8 });
    expect(m).toEqual({ left: 1150 - 8 - 220, top: 800 - 8 - 160 });
  });

  it('clamps inside the bounds when neither side fits', () => {
    const m = placeMenu({ point: { x: 100, y: 100 }, size: { width: 220, height: 900 }, bounds: SCREEN, offset: 8 });
    expect(m.top).toBe(SCREEN.top);
  });
});

describe('sheet heights', () => {
  const heights = sheetHeights(800);

  it('peek < half < full', () => {
    expect(heights.peek).toBeLessThan(heights.half);
    expect(heights.half).toBeLessThan(heights.full);
    expect(heights.full).toBe(800);
    expect(heights.half).toBe(400);
  });

  it('peek still leaves room for the grab bar, title and a row of controls', () => {
    expect(heights.peek).toBeGreaterThanOrEqual(150);
  });

  it('keeps peek below half in a short space', () => {
    const short = sheetHeights(260);
    expect(short.peek).toBeLessThan(short.half);
  });
});

describe('settleSheet', () => {
  const heights = sheetHeights(800);

  it('rests at the nearest height on a slow release', () => {
    expect(settleSheet(heights, heights.half + 30, 0)).toBe('half');
    expect(settleSheet(heights, heights.full - 50, 0)).toBe('full');
    expect(settleSheet(heights, heights.peek + 10, 0)).toBe('peek');
  });

  it('closes when dragged well below peek', () => {
    expect(settleSheet(heights, heights.peek / 3, 0)).toBe('closed');
    expect(settleSheet(heights, 0, 0)).toBe('closed');
  });

  it('a downward flick goes to the next height down, and closes from peek', () => {
    const down = SHEET_FLICK_SPEED * 2;
    expect(settleSheet(heights, heights.half - 10, down)).toBe('peek');
    expect(settleSheet(heights, heights.full - 10, down)).toBe('half');
    expect(settleSheet(heights, heights.peek - 10, down)).toBe('closed');
  });

  it('an upward flick goes to the next height up', () => {
    const up = -SHEET_FLICK_SPEED * 2;
    expect(settleSheet(heights, heights.half + 10, up)).toBe('full');
    expect(settleSheet(heights, heights.peek + 10, up)).toBe('half');
    expect(settleSheet(heights, heights.full, up)).toBe('full');
  });
});

describe('stepSheetDetent', () => {
  it('steps up and down without closing', () => {
    expect(stepSheetDetent('peek', 1)).toBe('half');
    expect(stepSheetDetent('half', 1)).toBe('full');
    expect(stepSheetDetent('full', 1)).toBe('full');
    expect(stepSheetDetent('half', -1)).toBe('peek');
    expect(stepSheetDetent('peek', -1)).toBe('peek');
  });
});
