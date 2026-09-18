import type { PerspectiveGridConfig } from '@artiso/shared-types';
import type { GridGeometry, LineSegment } from './types';

interface Point {
  x: number;
  y: number;
}

// Vanishing points are often placed outside the visible frame in real 2/3-
// point perspective (that's what makes the convergence read as natural), so
// positions are derived from horizonY rather than exposed as free-form
// coordinates in this v1 -- a fixed, sensible default per point count rather
// than interactively draggable vanishing points, which is a reasonable
// follow-up refinement, not required to make the guide useful.
function resolveVanishingPoints(width: number, height: number, config: PerspectiveGridConfig): Point[] {
  const horizonY = config.horizonY * height;

  if (config.vanishingPointCount === 1) {
    return [{ x: width / 2, y: horizonY }];
  }

  const left: Point = { x: -width / 2, y: horizonY };
  const right: Point = { x: width * 1.5, y: horizonY };

  if (config.vanishingPointCount === 2) {
    return [left, right];
  }

  const third: Point = {
    x: width / 2,
    y: config.thirdPointPosition === 'above' ? -height : height * 2,
  };
  return [left, right, third];
}

export function generatePerspectiveGrid(width: number, height: number, config: PerspectiveGridConfig): GridGeometry {
  const points = resolveVanishingPoints(width, height, config);
  // Long enough that a line from any vanishing point (even ones placed
  // outside the frame) still crosses the entire visible canvas in every
  // direction -- Canvas2D clips the rest for free, no bounds math needed.
  const reach = Math.hypot(width, height) * 4;

  const lines: LineSegment[] = [];
  for (const point of points) {
    for (let i = 0; i < config.lineCount; i++) {
      const angle = (i / config.lineCount) * Math.PI * 2;
      lines.push({
        x1: point.x,
        y1: point.y,
        x2: point.x + Math.cos(angle) * reach,
        y2: point.y + Math.sin(angle) * reach,
      });
    }
  }

  // A horizon line anchors 2/3-point setups visually; skipped for 1-point,
  // where there's no meaningful horizon to draw.
  if (config.vanishingPointCount >= 2) {
    const y = config.horizonY * height;
    lines.push({ x1: 0, y1: y, x2: width, y2: y });
  }

  return { lines, labels: [] };
}
