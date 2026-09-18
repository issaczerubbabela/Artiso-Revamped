import type { GridGeometry } from './types';

// Two vertical + two horizontal lines at the 1/3 and 2/3 marks -- the
// classic compositional guide, no numbering (it's a placement aid, not a
// measurement grid).
export function generateRuleOfThirdsGrid(width: number, height: number): GridGeometry {
  const x1 = width / 3;
  const x2 = (2 * width) / 3;
  const y1 = height / 3;
  const y2 = (2 * height) / 3;

  return {
    lines: [
      { x1, y1: 0, x2: x1, y2: height },
      { x1: x2, y1: 0, x2: x2, y2: height },
      { x1: 0, y1, x2: width, y2: y1 },
      { x1: 0, y1: y2, x2: width, y2: y2 },
    ],
    labels: [],
  };
}
