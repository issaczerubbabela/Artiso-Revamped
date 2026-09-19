import type { PaperSize } from './square-grid';
import { GridConfigError, type LineSegment } from './types';

/**
 * Radial spokes (Grid-Feature-Spec.md §8): from the exact centre of the paper
 * straight to the paper edge -- no concentric circles. Spokes sit at
 * `k * stepDeg` for `k = 0 .. floor(360 / step) - 1`; 0 degrees points right,
 * and angles advance towards +y (clockwise on screen). Each ray ends where it
 * meets the paper rectangle.
 */
export function getRadialRays(paper: PaperSize, stepDeg: number): LineSegment[] {
  if (!(stepDeg > 0) || stepDeg > 90 || !Number.isFinite(stepDeg)) {
    throw new GridConfigError(`radial step must be within (0, 90] degrees, got ${stepDeg}`);
  }
  const { widthMm: W, heightMm: H } = paper;
  const cx = W / 2;
  const cy = H / 2;
  const count = Math.floor(360 / stepDeg + 1e-9);

  const rays: LineSegment[] = [];
  for (let k = 0; k < count; k++) {
    const angle = ((k * stepDeg) * Math.PI) / 180;
    // Snap the float noise (cos 90deg is ~6e-17) so axis-aligned rays are exact.
    const dx = snap(Math.cos(angle));
    const dy = snap(Math.sin(angle));
    const tx = dx > 0 ? (W - cx) / dx : dx < 0 ? -cx / dx : Infinity;
    const ty = dy > 0 ? (H - cy) / dy : dy < 0 ? -cy / dy : Infinity;
    const t = Math.min(tx, ty);
    rays.push({ x1: cx, y1: cy, x2: cx + dx * t, y2: cy + dy * t });
  }
  return rays;
}

function snap(v: number): number {
  return Math.abs(v) < 1e-12 ? 0 : v;
}
