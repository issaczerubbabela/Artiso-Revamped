import { describe, expect, it } from 'vitest';
import { getDiagonals } from '../diagonals';
import { getCols, getRows } from '../square-grid';
import { GridConfigError } from '../types';

const A4 = { widthMm: 210, heightMm: 297 };

const slope = (l: { x1: number; y1: number; x2: number; y2: number }) => (l.y2 - l.y1) / (l.x2 - l.x1);

describe('getDiagonals', () => {
  it('draws an X (two diagonals) in every square', () => {
    // 210 x 300 with 30 mm cells is exactly 7 x 10 = 70 squares.
    const diagonals = getDiagonals({ widthMm: 210, heightMm: 300 }, 30);
    expect(diagonals).toHaveLength(70 * 2);
  });

  it('gives each square one down-right and one up-right diagonal', () => {
    const diagonals = getDiagonals({ widthMm: 60, heightMm: 60 }, 30);
    expect(diagonals).toHaveLength(8);
    expect(diagonals.filter((d) => slope(d) > 0)).toHaveLength(4);
    expect(diagonals.filter((d) => slope(d) < 0)).toHaveLength(4);
    // The first square's X runs corner to corner.
    expect(diagonals).toContainEqual({ x1: 0, y1: 0, x2: 30, y2: 30 });
    expect(diagonals).toContainEqual({ x1: 30, y1: 0, x2: 0, y2: 30 });
  });

  it('keeps every diagonal at exactly 45 degrees, including in partial cells', () => {
    const diagonals = getDiagonals(A4, 25);
    expect(diagonals.length).toBeGreaterThan(0);
    for (const d of diagonals) {
      expect(Math.abs(slope(d))).toBeCloseTo(1, 9);
    }
  });

  it('clips the full virtual square of a partial cell at the paper edge', () => {
    // 210 / 25: the last column is virtual [200, 225] but the paper ends at 210.
    const diagonals = getDiagonals(A4, 25);
    const inLastColumnTopRow = diagonals.filter((d) => Math.min(d.x1, d.x2) >= 200 && Math.max(d.y1, d.y2) <= 25);
    expect(inLastColumnTopRow).toHaveLength(2);
    const down = inLastColumnTopRow.find((d) => slope(d) > 0)!;
    expect(down).toMatchObject({ x1: 200, y1: 0 });
    expect(down.x2).toBeCloseTo(210, 9);
    expect(down.y2).toBeCloseTo(10, 9); // 10 mm across -> 10 mm down, not the full 25
  });

  it('never leaves the paper', () => {
    for (const d of getDiagonals(A4, 17)) {
      for (const [x, y] of [
        [d.x1, d.y1],
        [d.x2, d.y2],
      ] as const) {
        expect(x).toBeGreaterThanOrEqual(-1e-9);
        expect(x).toBeLessThanOrEqual(210 + 1e-9);
        expect(y).toBeGreaterThanOrEqual(-1e-9);
        expect(y).toBeLessThanOrEqual(297 + 1e-9);
      }
    }
  });

  it('produces two diagonals per cell in total, partial cells included', () => {
    const count = getCols(A4.widthMm, 25) * getRows(A4.heightMm, 25);
    expect(getDiagonals(A4, 25)).toHaveLength(count * 2);
  });

  it('only generates cells that overlap the visible rectangle', () => {
    const visible = getDiagonals({ widthMm: 300, heightMm: 300 }, 30, { x: 35, y: 35, w: 20, h: 20 });
    // Overlaps cells (1,1) only... x 35..55 spans cells 1 (30-60); y likewise.
    expect(visible).toHaveLength(2);
    expect(visible).toContainEqual({ x1: 30, y1: 30, x2: 60, y2: 60 });
  });

  it('returns nothing when the view misses the paper', () => {
    expect(getDiagonals(A4, 25, { x: 500, y: 500, w: 10, h: 10 })).toEqual([]);
  });

  it('rejects a non-positive cell size', () => {
    expect(() => getDiagonals(A4, 0)).toThrow(GridConfigError);
  });
});
