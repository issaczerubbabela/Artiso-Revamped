import { describe, expect, it } from 'vitest';
import { GridConfigError } from '../types';
import { cellRange, getCols, getLines, getRows } from '../square-grid';

const A4 = { widthMm: 210, heightMm: 297 };

const verticals = (lines: ReturnType<typeof getLines>) => lines.filter((l) => l.x1 === l.x2);
const horizontals = (lines: ReturnType<typeof getLines>) => lines.filter((l) => l.y1 === l.y2);

describe('getCols / getRows', () => {
  it('rounds up, so the last cell is partial', () => {
    expect(getCols(210, 25)).toBe(9); // 8.4 -> 9
    expect(getRows(297, 25)).toBe(12); // 11.88 -> 12
  });

  it('does not add a phantom cell on an exact multiple (float epsilon)', () => {
    expect(getCols(210, 30)).toBe(7);
    expect(getRows(297, 33)).toBe(9);
    // 0.1 * 3 is 0.30000000000000004 in floats; still exactly 3 cells of 0.1.
    expect(getCols(0.1 * 3, 0.1)).toBe(3);
  });

  it('is one cell when the cell is larger than the paper', () => {
    expect(getCols(210, 500)).toBe(1);
  });

  it.each([0, -5, NaN, Infinity])('rejects a cell size of %s', (cellMm) => {
    expect(() => getCols(210, cellMm)).toThrow(GridConfigError);
    expect(() => getRows(297, cellMm)).toThrow(GridConfigError);
    expect(() => getLines(A4, cellMm)).toThrow(GridConfigError);
  });
});

describe('getLines', () => {
  it('starts at the top-left with a border line at k = 0', () => {
    const lines = getLines(A4, 25);
    expect(verticals(lines)[0]).toEqual({ x1: 0, y1: 0, x2: 0, y2: 297 });
    expect(horizontals(lines)[0]).toEqual({ x1: 0, y1: 0, x2: 210, y2: 0 });
  });

  it('spaces lines exactly one cell apart and never stretches the last cell', () => {
    const xs = verticals(getLines(A4, 25)).map((l) => l.x1);
    expect(xs).toEqual([0, 25, 50, 75, 100, 125, 150, 175, 200]);
    // No line at 225 (outside the paper) and none forced onto the 210 edge:
    // the last column is the 10 mm sliver between 200 and the paper edge.
    expect(xs).not.toContain(210);
  });

  it('puts a line on the right/bottom edge only when the paper is an exact multiple', () => {
    const lines = getLines(A4, 30);
    expect(verticals(lines).map((l) => l.x1)).toEqual([0, 30, 60, 90, 120, 150, 180, 210]);
    expect(horizontals(lines).at(-1)?.y1).toBeCloseTo(270, 9); // 297 is not a multiple of 30
    expect(horizontals(getLines(A4, 33)).at(-1)?.y1).toBeCloseTo(297, 9);
  });

  it('clips every line to the paper rectangle', () => {
    for (const l of getLines(A4, 17)) {
      expect(Math.min(l.x1, l.x2)).toBeGreaterThanOrEqual(0);
      expect(Math.max(l.x1, l.x2)).toBeLessThanOrEqual(210 + 1e-9);
      expect(Math.min(l.y1, l.y2)).toBeGreaterThanOrEqual(0);
      expect(Math.max(l.y1, l.y2)).toBeLessThanOrEqual(297 + 1e-9);
    }
  });

  it('draws a single border pair when the cell is bigger than the paper', () => {
    const lines = getLines(A4, 500);
    expect(verticals(lines).map((l) => l.x1)).toEqual([0]);
    expect(horizontals(lines).map((l) => l.y1)).toEqual([0]);
  });

  describe('with a visible rectangle (culling)', () => {
    it('only generates lines inside it', () => {
      const lines = getLines(A4, 25, { x: 60, y: 60, w: 70, h: 40 });
      expect(verticals(lines).map((l) => l.x1)).toEqual([75, 100, 125]);
      expect(horizontals(lines).map((l) => l.y1)).toEqual([75, 100]);
    });

    it('includes a line sitting exactly on the visible boundary', () => {
      const lines = getLines(A4, 25, { x: 50, y: 0, w: 50, h: 297 });
      expect(verticals(lines).map((l) => l.x1)).toEqual([50, 75, 100]);
    });

    it('clamps to the paper and returns nothing when the view misses it', () => {
      expect(getLines(A4, 25, { x: 1000, y: 1000, w: 50, h: 50 })).toEqual([]);
      const all = getLines(A4, 25);
      expect(getLines(A4, 25, { x: -500, y: -500, w: 2000, h: 2000 })).toEqual(all);
    });

    it('still spans the full paper height so lines are not cut at the viewport', () => {
      const [first] = verticals(getLines(A4, 25, { x: 90, y: 90, w: 20, h: 20 }));
      expect(first).toEqual({ x1: 100, y1: 0, x2: 100, y2: 297 });
    });
  });
});

describe('cellRange', () => {
  it('returns the cells overlapping a span, clamped to the grid', () => {
    expect(cellRange(0, 210, 25, 9)).toEqual({ first: 0, last: 8 });
    expect(cellRange(60, 130, 25, 9)).toEqual({ first: 2, last: 5 });
    expect(cellRange(-100, 30, 25, 9)).toEqual({ first: 0, last: 1 });
    expect(cellRange(190, 900, 25, 9)).toEqual({ first: 7, last: 8 });
  });

  it('does not count a cell that is only touched at its edge', () => {
    expect(cellRange(25, 50, 25, 9)).toEqual({ first: 1, last: 1 });
  });

  it('is null when the span misses the grid', () => {
    expect(cellRange(300, 400, 25, 9)).toBeNull();
    expect(cellRange(-50, -10, 25, 9)).toBeNull();
  });
});
