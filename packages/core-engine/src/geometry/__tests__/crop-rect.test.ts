import { describe, expect, it } from 'vitest';
import { denormalizeCropRect, normalizeCropRect } from '../crop-rect';

describe('crop rect normalize/denormalize', () => {
  it('round-trips at working resolution', () => {
    const pixelRect = { x: 100, y: 50, w: 400, h: 300 };
    const normalized = normalizeCropRect(pixelRect, 800, 600);
    expect(normalized).toEqual({ x: 0.125, y: 0.08333333333333333, w: 0.5, h: 0.5 });
    expect(denormalizeCropRect(normalized, 800, 600)).toEqual(pixelRect);
  });

  it('round-trips the same normalized rect at a different (export) resolution', () => {
    const normalized = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
    expect(denormalizeCropRect(normalized, 4000, 3000)).toEqual({ x: 1000, y: 750, w: 2000, h: 1500 });
  });

  it('a full-frame rect normalizes to 0,0,1,1', () => {
    expect(normalizeCropRect({ x: 0, y: 0, w: 800, h: 600 }, 800, 600)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});
