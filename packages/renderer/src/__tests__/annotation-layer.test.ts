import { describe, expect, it } from 'vitest';
import { freehandSegmentWidths, pressureWidthFactor } from '../annotation-layer';

describe('pressureWidthFactor', () => {
  it('leaves a point without pressure at the base width', () => {
    expect(pressureWidthFactor(undefined)).toBe(1);
  });

  it('draws a medium press (and a mouse, which reports 0.5) at the base width', () => {
    expect(pressureWidthFactor(0.5)).toBeCloseTo(1);
  });

  it('thickens with harder pressure and thins with lighter', () => {
    expect(pressureWidthFactor(1)).toBeGreaterThan(1.5);
    expect(pressureWidthFactor(0.1)).toBeLessThan(0.5);
    expect(pressureWidthFactor(0.9)).toBeGreaterThan(pressureWidthFactor(0.6));
  });

  it('keeps a bad reading in range', () => {
    expect(pressureWidthFactor(5)).toBe(pressureWidthFactor(1));
    expect(pressureWidthFactor(-1)).toBe(pressureWidthFactor(0));
    expect(pressureWidthFactor(0)).toBeGreaterThan(0);
    expect(pressureWidthFactor(Number.NaN)).toBe(1);
  });
});

describe('freehandSegmentWidths', () => {
  it('is null for a stroke with no pressure: one path at the base width, as before', () => {
    expect(freehandSegmentWidths([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }], 3)).toBeNull();
  });

  it('is null for a constant pressure, such as a mouse button (0.5)', () => {
    expect(freehandSegmentWidths([{ x: 0, y: 0, pressure: 0.5 }, { x: 1, y: 1, pressure: 0.5 }], 3)).toBeNull();
  });

  it('keeps an even but light or heavy press: it still sets the width', () => {
    expect(freehandSegmentWidths([{ x: 0, y: 0, pressure: 0.1 }, { x: 1, y: 1, pressure: 0.1 }], 2)).toEqual([2 * pressureWidthFactor(0.1)]);
  });

  it('gives each segment the width of its average pressure', () => {
    const widths = freehandSegmentWidths(
      [
        { x: 0, y: 0, pressure: 0.5 },
        { x: 1, y: 0, pressure: 0.5 },
        { x: 2, y: 0, pressure: 1 },
      ],
      2,
    );
    expect(widths).toHaveLength(2);
    expect(widths![0]).toBeCloseTo(2);
    expect(widths![1]).toBeCloseTo(pressureWidthFactor(0.5) + pressureWidthFactor(1));
  });

  it('uses the base width for points that lack pressure within a pressured stroke', () => {
    const widths = freehandSegmentWidths(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0, pressure: 1 },
      ],
      2,
    );
    expect(widths![0]).toBeCloseTo(2 * ((1 + pressureWidthFactor(1)) / 2));
  });
});
