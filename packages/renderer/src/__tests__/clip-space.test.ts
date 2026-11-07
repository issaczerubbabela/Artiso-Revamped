import { describe, expect, it } from 'vitest';
import { clipSpaceTransform } from '../clip-space';
import { Viewport, type ViewportState } from '../viewport';

// Applies a column-major mat2 + offset, as the vertex shader does.
function toClip(t: ReturnType<typeof clipSpaceTransform>, x: number, y: number) {
  const [m00, m10, m01, m11] = t.linear;
  return { x: m00 * x + m01 * y + t.offset[0], y: m10 * x + m11 * y + t.offset[1] };
}

// CSS px -> clip space (y up).
const cssToClip = (p: { x: number; y: number }, w: number, h: number) => ({ x: (2 * p.x) / w - 1, y: 1 - (2 * p.y) / h });

describe('clipSpaceTransform', () => {
  it('is the old per-axis scale and offset at 0°', () => {
    const view: ViewportState = { scale: 2.5, translateX: 40, translateY: 70, rotation: 0 };
    const t = clipSpaceTransform(view, 800, 600);
    expect(t.linear[0]).toBe((2 * 2.5) / 800);
    expect(t.linear[3]).toBe((-2 * 2.5) / 600);
    expect(t.linear[1]).toBeCloseTo(0, 15);
    expect(t.linear[2]).toBeCloseTo(0, 15);
    expect(t.offset).toEqual([(2 * 40) / 800 - 1, 1 - (2 * 70) / 600]);
  });

  it('puts every content point where the viewport says it is on screen, at any angle', () => {
    const viewport = new Viewport(800, 600, 210, 297, { minScale: 0.01 });
    for (const rotation of [0, 0.4, Math.PI / 2, -2.2]) {
      viewport.setState({ scale: 3, translateX: 350, translateY: 120, rotation });
      const t = clipSpaceTransform(viewport.getState(), 800, 600);
      for (const p of [
        { x: 0, y: 0 },
        { x: 210, y: 0 },
        { x: 105, y: 200 },
      ]) {
        const expected = cssToClip(viewport.imageToScreen(p), 800, 600);
        const actual = toClip(t, p.x, p.y);
        expect(actual.x).toBeCloseTo(expected.x, 12);
        expect(actual.y).toBeCloseTo(expected.y, 12);
      }
    }
  });
});
