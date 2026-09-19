import { describe, expect, it } from 'vitest';
import { getRadialRays } from '../radial-rays';
import { GridConfigError } from '../types';

const A4 = { widthMm: 210, heightMm: 297 };
const CENTRE = { x: 105, y: 148.5 };

function onPaperEdge(x: number, y: number, W: number, H: number): boolean {
  const eps = 1e-9;
  const onVertical = Math.abs(x) < eps || Math.abs(x - W) < eps;
  const onHorizontal = Math.abs(y) < eps || Math.abs(y - H) < eps;
  return (onVertical && y >= -eps && y <= H + eps) || (onHorizontal && x >= -eps && x <= W + eps);
}

describe('getRadialRays', () => {
  it.each([
    [1, 360],
    [15, 24],
    [30, 12],
    [45, 8],
    [90, 4],
    [7, 51], // floor(360 / 7)
  ])('draws floor(360 / %s) = %s spokes', (step, count) => {
    expect(getRadialRays(A4, step)).toHaveLength(count);
  });

  it('starts every ray at the exact centre of the paper', () => {
    for (const ray of getRadialRays(A4, 15)) {
      expect(ray.x1).toBe(CENTRE.x);
      expect(ray.y1).toBe(CENTRE.y);
    }
  });

  it('ends every ray on the paper edge (clipped where it meets the rectangle)', () => {
    for (const step of [1, 7, 15, 45, 90]) {
      for (const ray of getRadialRays(A4, step)) {
        expect(onPaperEdge(ray.x2, ray.y2, 210, 297)).toBe(true);
      }
    }
  });

  it('points the first ray right (0 degrees) to the exact edge', () => {
    const [first] = getRadialRays(A4, 15);
    expect(first).toEqual({ x1: 105, y1: 148.5, x2: 210, y2: 148.5 });
  });

  it('hits the axis-aligned edges exactly at 90 degree steps', () => {
    const rays = getRadialRays(A4, 90);
    expect(rays[0]).toMatchObject({ x2: 210, y2: 148.5 }); // right
    expect(rays[1]).toMatchObject({ x2: 105, y2: 297 }); // down (+y)
    expect(rays[2]).toMatchObject({ x2: 0, y2: 148.5 }); // left
    expect(rays[3]).toMatchObject({ x2: 105, y2: 0 }); // up
  });

  it('runs straight to the corner along the diagonal of a square paper at 45 degrees', () => {
    const rays = getRadialRays({ widthMm: 100, heightMm: 100 }, 45);
    expect(rays[1]?.x2).toBeCloseTo(100, 9);
    expect(rays[1]?.y2).toBeCloseTo(100, 9);
  });

  it('spaces the spokes by the step angle', () => {
    const rays = getRadialRays(A4, 30);
    const angle = (r: (typeof rays)[number]) => (Math.atan2(r.y2 - r.y1, r.x2 - r.x1) * 180) / Math.PI;
    expect(angle(rays[0]!)).toBeCloseTo(0, 9);
    expect(angle(rays[1]!)).toBeCloseTo(30, 9);
    expect(angle(rays[3]!)).toBeCloseTo(90, 9);
  });

  it('draws only straight spokes -- no concentric circles', () => {
    // Every segment is centre -> edge; a circle would need many short chords.
    const rays = getRadialRays(A4, 15);
    expect(rays.every((r) => r.x1 === CENTRE.x && r.y1 === CENTRE.y)).toBe(true);
  });

  it.each([0, -15, 91, NaN, Infinity])('rejects a step of %s', (step) => {
    expect(() => getRadialRays(A4, step)).toThrow(GridConfigError);
  });
});
