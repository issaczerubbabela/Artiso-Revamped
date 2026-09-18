import { describe, expect, it } from 'vitest';
import { generateRectangularGrid, MAX_GRID_CELLS } from '../generate-rectangular-grid';
import { GridConfigError } from '../types';

const baseConfig = { rows: 4, cols: 4, numberingMode: 'off' as const };

describe('generateRectangularGrid', () => {
  it('generates (cols - 1) vertical and (rows - 1) horizontal lines', () => {
    const { lines } = generateRectangularGrid(400, 400, { ...baseConfig, rows: 4, cols: 5 });
    const vertical = lines.filter((l) => l.x1 === l.x2);
    const horizontal = lines.filter((l) => l.y1 === l.y2);
    expect(vertical).toHaveLength(4);
    expect(horizontal).toHaveLength(3);
  });

  it('spaces lines evenly across image-space dimensions', () => {
    const { lines } = generateRectangularGrid(100, 200, { rows: 2, cols: 2, numberingMode: 'off' });
    const vertical = lines.find((l) => l.x1 === l.x2);
    const horizontal = lines.find((l) => l.y1 === l.y2);
    expect(vertical).toEqual({ x1: 50, y1: 0, x2: 50, y2: 200 });
    expect(horizontal).toEqual({ x1: 0, y1: 100, x2: 100, y2: 100 });
  });

  it('produces a single cell with no lines for a 1x1 grid', () => {
    const { lines } = generateRectangularGrid(100, 100, { rows: 1, cols: 1, numberingMode: 'off' });
    expect(lines).toHaveLength(0);
  });

  it('includes labels when numberingMode is not off', () => {
    const { labels } = generateRectangularGrid(100, 100, { rows: 2, cols: 2, numberingMode: 'numbers' });
    expect(labels).toHaveLength(4);
  });

  it('omits labels when numberingMode is off', () => {
    const { labels } = generateRectangularGrid(100, 100, { ...baseConfig, numberingMode: 'off' });
    expect(labels).toHaveLength(0);
  });

  it('rejects a grid below 1x1', () => {
    expect(() => generateRectangularGrid(100, 100, { ...baseConfig, rows: 0 })).toThrow(GridConfigError);
  });

  it('rejects a grid exceeding the max cell count', () => {
    expect(() => generateRectangularGrid(1000, 1000, { rows: 100, cols: 100, numberingMode: 'off' })).toThrow(
      GridConfigError,
    );
  });

  it('accepts a grid exactly at the max cell count', () => {
    expect(() => generateRectangularGrid(1000, 1000, { rows: 50, cols: 50, numberingMode: 'off' })).not.toThrow();
    expect(50 * 50).toBe(MAX_GRID_CELLS);
  });
});
