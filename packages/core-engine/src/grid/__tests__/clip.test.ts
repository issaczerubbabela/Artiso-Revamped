import { describe, expect, it } from 'vitest';
import { clipSegmentToRect } from '../clip';

const RECT = { x: 0, y: 0, w: 100, h: 50 };

describe('clipSegmentToRect', () => {
  it('returns a fully inside segment unchanged', () => {
    const seg = { x1: 10, y1: 10, x2: 90, y2: 40 };
    expect(clipSegmentToRect(seg, RECT)).toEqual(seg);
  });

  it('trims the part that leaves through an edge', () => {
    const clipped = clipSegmentToRect({ x1: 50, y1: 25, x2: 150, y2: 25 }, RECT);
    expect(clipped).toEqual({ x1: 50, y1: 25, x2: 100, y2: 25 });
  });

  it('trims both ends of a segment that crosses the whole rectangle', () => {
    const clipped = clipSegmentToRect({ x1: -50, y1: 10, x2: 150, y2: 10 }, RECT);
    expect(clipped).toEqual({ x1: 0, y1: 10, x2: 100, y2: 10 });
  });

  it('keeps the slope of a diagonal it clips', () => {
    const clipped = clipSegmentToRect({ x1: 80, y1: 10, x2: 130, y2: 60 }, RECT);
    expect(clipped).not.toBeNull();
    const c = clipped!;
    expect(c.x2 - c.x1).toBeCloseTo(c.y2 - c.y1, 9); // still 45 degrees
    expect(c.x2).toBeCloseTo(100, 9);
  });

  it('returns null when the segment is entirely outside', () => {
    expect(clipSegmentToRect({ x1: 200, y1: 0, x2: 300, y2: 50 }, RECT)).toBeNull();
    expect(clipSegmentToRect({ x1: 0, y1: 80, x2: 100, y2: 80 }, RECT)).toBeNull();
  });

  it('returns null when it only touches a corner', () => {
    expect(clipSegmentToRect({ x1: 100, y1: 50, x2: 150, y2: 100 }, RECT)).toBeNull();
  });

  it('handles axis-parallel segments on the boundary', () => {
    const clipped = clipSegmentToRect({ x1: 0, y1: 0, x2: 100, y2: 0 }, RECT);
    expect(clipped).toEqual({ x1: 0, y1: 0, x2: 100, y2: 0 });
  });
});
