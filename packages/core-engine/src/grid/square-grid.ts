import type { MmRect } from './clip';
import { GridConfigError, type LineSegment } from './types';

// The drawing grid (docs/architecture/Grid-Feature-Spec.md §6). Coordinates are
// millimetres with the origin at the top-left of the paper, x right, y down.
// Cells are fixed-size squares starting at the top-left, so the last column
// and row are *partial* when the paper isn't a multiple of the cell size --
// they are cut by the paper edge, never stretched.

export interface PaperSize {
  widthMm: number;
  heightMm: number;
}

/** Absorbs float error so an exact multiple (e.g. 210 / 30) doesn't gain a phantom cell. */
export const GRID_EPSILON = 1e-9;

export function assertCellMm(cellMm: number): void {
  if (!(cellMm > 0) || !Number.isFinite(cellMm)) {
    throw new GridConfigError(`cellMm must be a positive finite number, got ${cellMm}`);
  }
}

export function getCols(widthMm: number, cellMm: number): number {
  assertCellMm(cellMm);
  return Math.ceil(widthMm / cellMm - GRID_EPSILON);
}

export function getRows(heightMm: number, cellMm: number): number {
  assertCellMm(cellMm);
  return Math.ceil(heightMm / cellMm - GRID_EPSILON);
}

export interface IndexRange {
  first: number;
  last: number;
}

/**
 * The cells (0-based) that overlap the span [minMm, maxMm] by a positive
 * amount, clamped to `count` cells; null when the span misses the grid. This is
 * how everything culls to the viewport.
 */
export function cellRange(minMm: number, maxMm: number, cellMm: number, count: number): IndexRange | null {
  const first = Math.max(0, Math.floor(minMm / cellMm + GRID_EPSILON));
  const last = Math.min(count - 1, Math.ceil(maxMm / cellMm - GRID_EPSILON) - 1);
  return last < first ? null : { first, last };
}

/**
 * The grid lines at `x = k * cellMm` (vertical) and `y = k * cellMm`
 * (horizontal), clipped to the paper, verticals first. A line lands on the
 * paper's right/bottom edge only when the paper is an exact multiple of the
 * cell size. With `visible` (a mm rectangle), only lines inside it are
 * generated -- this is the culling that keeps a fine grid cheap.
 */
export function getLines(paper: PaperSize, cellMm: number, visible?: MmRect): LineSegment[] {
  assertCellMm(cellMm);
  const { widthMm: W, heightMm: H } = paper;
  const lines: LineSegment[] = [];

  const xMin = visible ? Math.max(0, visible.x) : 0;
  const xMax = visible ? Math.min(W, visible.x + visible.w) : W;
  const yMin = visible ? Math.max(0, visible.y) : 0;
  const yMax = visible ? Math.min(H, visible.y + visible.h) : H;

  if (xMax >= xMin) {
    const kFirst = Math.max(0, Math.ceil(xMin / cellMm - GRID_EPSILON));
    const kLast = Math.min(Math.floor(xMax / cellMm + GRID_EPSILON), Math.floor(W / cellMm + GRID_EPSILON));
    for (let k = kFirst; k <= kLast; k++) {
      const x = Math.min(k * cellMm, W);
      lines.push({ x1: x, y1: 0, x2: x, y2: H });
    }
  }

  if (yMax >= yMin) {
    const kFirst = Math.max(0, Math.ceil(yMin / cellMm - GRID_EPSILON));
    const kLast = Math.min(Math.floor(yMax / cellMm + GRID_EPSILON), Math.floor(H / cellMm + GRID_EPSILON));
    for (let k = kFirst; k <= kLast; k++) {
      const y = Math.min(k * cellMm, H);
      lines.push({ x1: 0, y1: y, x2: W, y2: y });
    }
  }

  return lines;
}
