import { describe, expect, it } from 'vitest';
import { labelBox } from '../pointer-overlays';

describe('labelBox', () => {
  const canvas = { w: 400, h: 300 };
  const size = { w: 60, h: 24 };

  it('sits right of and above the anchor', () => {
    expect(labelBox({ x: 100, y: 100 }, size, canvas, 18)).toEqual({ x: 118, y: 58 });
  });

  it('flips left near the right edge and below near the top', () => {
    expect(labelBox({ x: 380, y: 10 }, size, canvas, 18)).toEqual({ x: 302, y: 28 });
  });

  it('stays on the canvas whatever happens', () => {
    const box = labelBox({ x: 10, y: 295 }, { w: 500, h: 24 }, canvas, 18);
    expect(box.x).toBe(0);
    expect(box.y).toBeLessThanOrEqual(canvas.h - 24);
  });
});
