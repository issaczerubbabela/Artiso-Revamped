import type { RadialGridConfig } from '@artiso/shared-types';
import { GridConfigError, type GridGeometry, type LineSegment } from './types';

// Rings are approximated as many-sided polygons rather than true arcs --
// GridGeometry only has straight LineSegments (docs/architecture/04's
// {lines, labels} shape), so this keeps the renderer completely unchanged
// (.agents/workflows/add-new-grid-type-recipe.md's own verification step:
// "confirm the renderer required zero changes to draw the new geometry
// type"). 72 segments per ring is visually smooth at any zoom a reference
// photo is realistically viewed at.
const SEGMENTS_PER_RING = 72;
const MAX_RINGS = 24;
const MAX_SPOKES = 48;

export function generateRadialGrid(
  width: number,
  height: number,
  config: Pick<RadialGridConfig, 'centerX' | 'centerY' | 'rings' | 'spokes'>,
): GridGeometry {
  const { rings, spokes } = config;
  if (rings < 1 || spokes < 1) {
    throw new GridConfigError(`Radial grid needs at least 1 ring and 1 spoke, got ${rings} rings, ${spokes} spokes`);
  }
  if (rings > MAX_RINGS || spokes > MAX_SPOKES) {
    throw new GridConfigError(`Radial grid exceeds the maximum of ${MAX_RINGS} rings / ${MAX_SPOKES} spokes`);
  }

  const cx = config.centerX * width;
  const cy = config.centerY * height;
  // Reaches the farthest corner so the outermost ring and spokes cover the
  // whole frame regardless of where the center sits.
  const maxRadius = Math.max(Math.hypot(cx, cy), Math.hypot(width - cx, cy), Math.hypot(cx, height - cy), Math.hypot(width - cx, height - cy));

  const lines: LineSegment[] = [];

  for (let ring = 1; ring <= rings; ring++) {
    const radius = (ring / rings) * maxRadius;
    for (let i = 0; i < SEGMENTS_PER_RING; i++) {
      const angleA = (i / SEGMENTS_PER_RING) * Math.PI * 2;
      const angleB = ((i + 1) / SEGMENTS_PER_RING) * Math.PI * 2;
      lines.push({
        x1: cx + Math.cos(angleA) * radius,
        y1: cy + Math.sin(angleA) * radius,
        x2: cx + Math.cos(angleB) * radius,
        y2: cy + Math.sin(angleB) * radius,
      });
    }
  }

  for (let i = 0; i < spokes; i++) {
    const angle = (i / spokes) * Math.PI * 2;
    lines.push({ x1: cx, y1: cy, x2: cx + Math.cos(angle) * maxRadius, y2: cy + Math.sin(angle) * maxRadius });
  }

  return { lines, labels: [] };
}
