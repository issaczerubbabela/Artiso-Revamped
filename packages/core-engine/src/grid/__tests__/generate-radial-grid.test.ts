import { describe, expect, it } from 'vitest';
import { generateRadialGrid } from '../generate-radial-grid';
import { GridConfigError } from '../types';

describe('generateRadialGrid', () => {
  it('generates 72 segments per ring plus one line per spoke', () => {
    const { lines } = generateRadialGrid(200, 200, { centerX: 0.5, centerY: 0.5, rings: 3, spokes: 8 });
    expect(lines).toHaveLength(3 * 72 + 8);
  });

  it('spokes radiate from the configured center', () => {
    const { lines } = generateRadialGrid(200, 100, { centerX: 0.5, centerY: 0.5, rings: 1, spokes: 4 });
    const spokes = lines.slice(-4);
    for (const spoke of spokes) {
      expect(spoke.x1).toBe(100);
      expect(spoke.y1).toBe(50);
    }
  });

  it('rejects zero rings or spokes', () => {
    expect(() => generateRadialGrid(200, 200, { centerX: 0.5, centerY: 0.5, rings: 0, spokes: 4 })).toThrow(
      GridConfigError,
    );
    expect(() => generateRadialGrid(200, 200, { centerX: 0.5, centerY: 0.5, rings: 4, spokes: 0 })).toThrow(
      GridConfigError,
    );
  });

  it('rejects pathologically large ring/spoke counts', () => {
    expect(() => generateRadialGrid(200, 200, { centerX: 0.5, centerY: 0.5, rings: 100, spokes: 4 })).toThrow(
      GridConfigError,
    );
  });

  it('has no labels', () => {
    expect(generateRadialGrid(200, 200, { centerX: 0.5, centerY: 0.5, rings: 1, spokes: 4 }).labels).toHaveLength(0);
  });
});
