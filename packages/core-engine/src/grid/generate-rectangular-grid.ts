import type { RectangularGridConfig } from '@artiso/shared-types';
import { generateLabels } from './labels';
import { GridConfigError, type GridGeometry, type LineSegment } from './types';

// docs/architecture/04-grid-engine.md: cap total cells so pathological
// configs (e.g. 500x500) can't blow up geometry generation or the draw call
// count.
export const MAX_GRID_CELLS = 2500;

export function generateRectangularGrid(
  width: number,
  height: number,
  config: Pick<RectangularGridConfig, 'rows' | 'cols' | 'numberingMode'>,
): GridGeometry {
  const { rows, cols, numberingMode } = config;

  if (rows < 1 || cols < 1) {
    throw new GridConfigError(`Grid must have at least 1 row and 1 column, got ${rows}x${cols}`);
  }
  if (rows * cols > MAX_GRID_CELLS) {
    throw new GridConfigError(
      `Grid of ${rows}x${cols} (${rows * cols} cells) exceeds the maximum of ${MAX_GRID_CELLS} cells`,
    );
  }

  const cellWidth = width / cols;
  const cellHeight = height / rows;

  const lines: LineSegment[] = [];
  for (let col = 1; col < cols; col++) {
    const x = col * cellWidth;
    lines.push({ x1: x, y1: 0, x2: x, y2: height });
  }
  for (let row = 1; row < rows; row++) {
    const y = row * cellHeight;
    lines.push({ x1: 0, y1: y, x2: width, y2: y });
  }

  const labels = generateLabels(rows, cols, cellWidth, cellHeight, numberingMode);

  return { lines, labels };
}
