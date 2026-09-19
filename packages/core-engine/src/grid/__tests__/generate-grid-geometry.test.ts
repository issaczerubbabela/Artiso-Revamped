import { describe, expect, it } from 'vitest';
import { generateGridGeometry } from '../generate-grid-geometry';
import type { GridConfig } from '@artiso/shared-types';

const BASE_STYLE = { color: '#ffffff', opacity: 70, thickness: 'medium' as const, visible: true };

// Full coverage of each type's own geometry math lives in that type's own
// test file (generate-perspective-grid.test.ts etc.) -- this only verifies
// the dispatcher routes each config.type to the right generator and always
// returns the same {lines, labels} shape.
describe('generateGridGeometry dispatch', () => {
  it('draws nothing for the retired rectangular and radial types', () => {
    const rectangular: GridConfig = { ...BASE_STYLE, type: 'rectangular', rows: 2, cols: 2, numberingMode: 'off', snapToImage: true };
    const radial: GridConfig = { ...BASE_STYLE, type: 'radial', centerX: 0.5, centerY: 0.5, rings: 2, spokes: 4 };
    expect(generateGridGeometry(100, 100, rectangular)).toEqual({ lines: [], labels: [] });
    expect(generateGridGeometry(100, 100, radial)).toEqual({ lines: [], labels: [] });
  });

  it('perspective', () => {
    const config: GridConfig = {
      ...BASE_STYLE,
      type: 'perspective',
      vanishingPointCount: 1,
      horizonY: 0.5,
      lineCount: 8,
      thirdPointPosition: 'below',
    };
    const { lines } = generateGridGeometry(100, 100, config);
    expect(lines.length).toBe(8);
  });

  it('ruleOfThirds', () => {
    const config: GridConfig = { ...BASE_STYLE, type: 'ruleOfThirds' };
    const { lines } = generateGridGeometry(100, 100, config);
    expect(lines).toHaveLength(4);
  });

  it('goldenRatio', () => {
    const config: GridConfig = { ...BASE_STYLE, type: 'goldenRatio', orientation: 'both' };
    const { lines } = generateGridGeometry(100, 100, config);
    expect(lines).toHaveLength(4);
  });
});
