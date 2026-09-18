import { describe, expect, it } from 'vitest';
import { generatePerspectiveGrid } from '../generate-perspective-grid';
import type { PerspectiveGridConfig } from '@artiso/shared-types';

const BASE: Omit<PerspectiveGridConfig, 'vanishingPointCount'> = {
  type: 'perspective',
  color: '#ffffff',
  opacity: 70,
  thickness: 'thin',
  visible: true,
  horizonY: 0.5,
  lineCount: 8,
  thirdPointPosition: 'below',
};

describe('generatePerspectiveGrid', () => {
  it('one-point: lineCount lines, no horizon line', () => {
    const { lines } = generatePerspectiveGrid(400, 300, { ...BASE, vanishingPointCount: 1 });
    expect(lines).toHaveLength(8);
  });

  it('two-point: lineCount x 2 points, plus one horizon line', () => {
    const { lines } = generatePerspectiveGrid(400, 300, { ...BASE, vanishingPointCount: 2 });
    expect(lines).toHaveLength(8 * 2 + 1);
  });

  it('three-point: lineCount x 3 points, plus one horizon line', () => {
    const { lines } = generatePerspectiveGrid(400, 300, { ...BASE, vanishingPointCount: 3 });
    expect(lines).toHaveLength(8 * 3 + 1);
  });

  it('one-point vanishing point sits at image center', () => {
    const { lines } = generatePerspectiveGrid(400, 300, { ...BASE, vanishingPointCount: 1 });
    expect(lines[0]?.x1).toBe(200);
    expect(lines[0]?.y1).toBe(150);
  });

  it('lines reach far enough to cross the visible canvas regardless of vanishing point position', () => {
    const { lines } = generatePerspectiveGrid(400, 300, { ...BASE, vanishingPointCount: 2 });
    // Every non-horizon line should span a distance much larger than the canvas.
    for (const line of lines.slice(0, -1)) {
      const length = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
      expect(length).toBeGreaterThan(Math.hypot(400, 300));
    }
  });

  it('has no labels', () => {
    expect(generatePerspectiveGrid(400, 300, { ...BASE, vanishingPointCount: 1 }).labels).toHaveLength(0);
  });
});
