export interface LineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface GridLabel {
  text: string;
  x: number;
  y: number;
}

// Image-space only (docs/architecture/04-grid-engine.md) — the renderer
// applies the pan/zoom transform at draw time, so this never carries screen
// coordinates and never needs to know about the viewport.
export interface GridGeometry {
  lines: LineSegment[];
  labels: GridLabel[];
}

export class GridConfigError extends Error {}
