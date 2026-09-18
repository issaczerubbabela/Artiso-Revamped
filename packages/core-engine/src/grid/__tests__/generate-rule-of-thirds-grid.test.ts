import { describe, expect, it } from 'vitest';
import { generateRuleOfThirdsGrid } from '../generate-rule-of-thirds-grid';

describe('generateRuleOfThirdsGrid', () => {
  it('generates exactly 2 vertical and 2 horizontal lines', () => {
    const { lines } = generateRuleOfThirdsGrid(900, 600);
    const vertical = lines.filter((l) => l.x1 === l.x2);
    const horizontal = lines.filter((l) => l.y1 === l.y2);
    expect(vertical).toHaveLength(2);
    expect(horizontal).toHaveLength(2);
  });

  it('places lines at the 1/3 and 2/3 marks', () => {
    const { lines } = generateRuleOfThirdsGrid(900, 600);
    const verticalXs = lines.filter((l) => l.x1 === l.x2).map((l) => l.x1).sort((a, b) => a - b);
    expect(verticalXs).toEqual([300, 600]);
    const horizontalYs = lines.filter((l) => l.y1 === l.y2).map((l) => l.y1).sort((a, b) => a - b);
    expect(horizontalYs).toEqual([200, 400]);
  });

  it('has no labels', () => {
    expect(generateRuleOfThirdsGrid(900, 600).labels).toHaveLength(0);
  });
});
