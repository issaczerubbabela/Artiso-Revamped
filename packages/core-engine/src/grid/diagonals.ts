import { clipSegmentToRect, type MmRect } from './clip';
import { assertCellMm, cellRange, getCols, getRows, type PaperSize } from './square-grid';
import type { LineSegment } from './types';

/**
 * Both diagonals (an X) of every square (Grid-Feature-Spec.md §8). In a partial
 * edge cell the diagonals of the *full virtual square* are drawn and clipped to
 * the paper, so every diagonal stays at exactly 45 degrees. With `visible`, only
 * cells overlapping that mm rectangle are generated.
 */
export function getDiagonals(paper: PaperSize, cellMm: number, visible?: MmRect): LineSegment[] {
  assertCellMm(cellMm);
  const { widthMm: W, heightMm: H } = paper;
  const cols = getCols(W, cellMm);
  const rows = getRows(H, cellMm);

  const colRange = cellRange(visible ? visible.x : 0, visible ? visible.x + visible.w : W, cellMm, cols);
  const rowRange = cellRange(visible ? visible.y : 0, visible ? visible.y + visible.h : H, cellMm, rows);
  if (!colRange || !rowRange) return [];

  const paperRect: MmRect = { x: 0, y: 0, w: W, h: H };
  const out: LineSegment[] = [];
  for (let j = rowRange.first; j <= rowRange.last; j++) {
    const y0 = j * cellMm;
    const y1 = y0 + cellMm;
    for (let i = colRange.first; i <= colRange.last; i++) {
      const x0 = i * cellMm;
      const x1 = x0 + cellMm;
      const down = clipSegmentToRect({ x1: x0, y1: y0, x2: x1, y2: y1 }, paperRect);
      const up = clipSegmentToRect({ x1: x1, y1: y0, x2: x0, y2: y1 }, paperRect);
      if (down) out.push(down);
      if (up) out.push(up);
    }
  }
  return out;
}
