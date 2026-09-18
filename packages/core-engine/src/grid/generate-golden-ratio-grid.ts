import type { GoldenRatioGridConfig } from '@artiso/shared-types';
import type { GridGeometry, LineSegment } from './types';

// Golden-ratio sectioning lines (phi-proportioned dividers), the same shape
// as a rule-of-thirds grid but split at 1/phi and 1-1/phi instead of 1/3 and
// 2/3. Deliberately the sectioning-line interpretation, not the full nested-
// rectangle golden spiral -- a reasonable v1 scope, noted here rather than
// silently narrowed.
const INVERSE_PHI = 2 / (1 + Math.sqrt(5)); // 1/phi ~= 0.618

export function generateGoldenRatioGrid(
  width: number,
  height: number,
  config: Pick<GoldenRatioGridConfig, 'orientation'>,
): GridGeometry {
  const lines: LineSegment[] = [];

  if (config.orientation === 'vertical' || config.orientation === 'both') {
    const a = width * (1 - INVERSE_PHI);
    const b = width * INVERSE_PHI;
    lines.push({ x1: a, y1: 0, x2: a, y2: height }, { x1: b, y1: 0, x2: b, y2: height });
  }

  if (config.orientation === 'horizontal' || config.orientation === 'both') {
    const a = height * (1 - INVERSE_PHI);
    const b = height * INVERSE_PHI;
    lines.push({ x1: 0, y1: a, x2: width, y2: a }, { x1: 0, y1: b, x2: width, y2: b });
  }

  return { lines, labels: [] };
}
