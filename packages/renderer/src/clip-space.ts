import { viewMatrix, type ViewportState } from './viewport';

export interface ClipSpaceTransform {
  // Column-major 2x2 (GLSL mat2 order): [m00, m10, m01, m11].
  linear: [number, number, number, number];
  offset: [number, number];
}

// The Viewport transform (content -> CSS px, View Rotation included) followed
// by CSS px -> WebGL clip space (-1..1, y up), as one linear part plus an
// offset: clip = linear * content + offset. At 0° the linear part is diagonal
// and this is the per-axis scale-and-offset the image layer always used.
export function clipSpaceTransform(view: ViewportState, canvasWidth: number, canvasHeight: number): ClipSpaceTransform {
  const m = viewMatrix(view);
  return {
    linear: [(2 * m.a) / canvasWidth, (-2 * m.b) / canvasHeight, (2 * m.c) / canvasWidth, (-2 * m.d) / canvasHeight],
    offset: [(2 * m.e) / canvasWidth - 1, 1 - (2 * m.f) / canvasHeight],
  };
}
