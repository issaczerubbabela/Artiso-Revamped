import type { LineSegment } from './types';

export interface MmRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Liang-Barsky clip of a segment to a rectangle. Returns null when nothing of
 * the segment is inside (or it only touches the rectangle at a point).
 */
export function clipSegmentToRect(seg: LineSegment, rect: MmRect): LineSegment | null {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const p = [-dx, dx, -dy, dy];
  const q = [seg.x1 - rect.x, rect.x + rect.w - seg.x1, seg.y1 - rect.y, rect.y + rect.h - seg.y1];

  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 4; i++) {
    const pi = p[i] as number;
    const qi = q[i] as number;
    if (pi === 0) {
      // Parallel to this edge: entirely outside if on the wrong side of it.
      if (qi < 0) return null;
      continue;
    }
    const r = qi / pi;
    if (pi < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  if (t1 - t0 < 1e-12) return null;

  return {
    x1: seg.x1 + t0 * dx,
    y1: seg.y1 + t0 * dy,
    x2: seg.x1 + t1 * dx,
    y2: seg.y1 + t1 * dy,
  };
}
