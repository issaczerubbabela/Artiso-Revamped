import { describe, expect, it } from 'vitest';
import { cellFocusDimAlpha, doneTickSize, screenQuad } from '../cell-focus-layer';

describe('cellFocusDimAlpha', () => {
  it('is the darkening as an alpha', () => {
    expect(cellFocusDimAlpha(70)).toBeCloseTo(0.7);
    expect(cellFocusDimAlpha(0)).toBe(0);
  });

  it('keeps a bad value in range', () => {
    expect(cellFocusDimAlpha(140)).toBe(1);
    expect(cellFocusDimAlpha(-5)).toBe(0);
    expect(cellFocusDimAlpha(Number.NaN)).toBe(0.7);
  });
});

describe('screenQuad', () => {
  it('projects a content rect through the view, turning with it', () => {
    const quad = screenQuad({ scale: 2, translateX: 10, translateY: 20, rotation: Math.PI / 2 }, { x: 0, y: 0, w: 5, h: 3 });
    const expected = [
      { x: 10, y: 20 },
      { x: 10, y: 30 },
      { x: 4, y: 30 },
      { x: 4, y: 20 },
    ];
    quad.forEach((p, i) => {
      expect(p.x).toBeCloseTo(expected[i]!.x);
      expect(p.y).toBeCloseTo(expected[i]!.y);
    });
  });
});

describe('doneTickSize', () => {
  it('scales with the cell on screen, within limits', () => {
    expect(doneTickSize(100)).toBe(40);
    expect(doneTickSize(60)).toBe(24);
    expect(doneTickSize(10)).toBe(8);
    expect(doneTickSize(1000)).toBe(48);
  });
});
