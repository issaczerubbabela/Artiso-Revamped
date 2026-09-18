import { describe, expect, it } from 'vitest';
import { generateGoldenRatioGrid } from '../generate-golden-ratio-grid';

describe('generateGoldenRatioGrid', () => {
  it('vertical orientation produces exactly 2 vertical lines', () => {
    const { lines } = generateGoldenRatioGrid(1000, 500, { orientation: 'vertical' });
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.x1 === l.x2)).toBe(true);
  });

  it('horizontal orientation produces exactly 2 horizontal lines', () => {
    const { lines } = generateGoldenRatioGrid(1000, 500, { orientation: 'horizontal' });
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.y1 === l.y2)).toBe(true);
  });

  it('both orientation produces all 4 lines', () => {
    const { lines } = generateGoldenRatioGrid(1000, 500, { orientation: 'both' });
    expect(lines).toHaveLength(4);
  });

  it('places vertical lines at the golden ratio proportions, not thirds', () => {
    const { lines } = generateGoldenRatioGrid(1000, 500, { orientation: 'vertical' });
    const xs = lines.map((l) => l.x1).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(382, 0);
    expect(xs[1]).toBeCloseTo(618, 0);
  });
});
