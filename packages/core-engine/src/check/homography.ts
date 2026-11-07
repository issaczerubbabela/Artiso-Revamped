// Perspective correction for the Drawing Check (GLOSSARY.md): a Check Photo
// is a photo of the artist's paper taken at an angle, so the paper shows up as
// a general quadrilateral. A homography -- a 3x3 projective transform -- maps
// that quadrilateral back onto the paper rectangle, so the photo can be laid
// over the reference and the grid square-on.
//
// Pure maths over plain numbers: no DOM, no canvas. The web app feeds it the
// photo's pixels and draws the result.

export interface Vec2 {
  x: number;
  y: number;
}

// Four corners, in order top-left, top-right, bottom-right, bottom-left once
// passed through orderCorners.
export type Quad = readonly [Vec2, Vec2, Vec2, Vec2];

// Row-major 3x3 matrix [h0 h1 h2; h3 h4 h5; h6 h7 h8], mapping (x, y, 1).
export type Homography = readonly [number, number, number, number, number, number, number, number, number];

// RGBA pixels, row by row, 4 bytes each -- the shape of a canvas ImageData.
export interface RgbaImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

// Puts four tapped corners into top-left, top-right, bottom-right,
// bottom-left order, whatever order they were tapped in. They are sorted by
// angle around their centroid (clockwise on screen, where y points down) and
// the cycle is started at the corner nearest the top-left (smallest x + y).
// That holds for a paper photographed turned by anything short of 45 degrees.
export function orderCorners(corners: readonly Vec2[]): Quad {
  if (corners.length !== 4) throw new Error('A paper has exactly four corners.');
  const cx = corners.reduce((sum, p) => sum + p.x, 0) / 4;
  const cy = corners.reduce((sum, p) => sum + p.y, 0) / 4;
  const clockwise = [...corners].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  let start = 0;
  for (let i = 1; i < 4; i++) {
    if (clockwise[i]!.x + clockwise[i]!.y < clockwise[start]!.x + clockwise[start]!.y) start = i;
  }
  const at = (i: number): Vec2 => clockwise[(start + i) % 4]!;
  return [at(0), at(1), at(2), at(3)];
}

// The homography taking each `src[i]` exactly onto `dst[i]`. Throws if either
// quad is degenerate (three corners in a line), since no such transform exists.
export function computeHomography(src: Quad, dst: Quad): Homography {
  assertNonDegenerate(src);
  assertNonDegenerate(dst);

  // The standard eight-equation system with h8 fixed at 1: for each pair,
  //   u = (h0 x + h1 y + h2) / (h6 x + h7 y + 1)
  //   v = (h3 x + h4 y + h5) / (h6 x + h7 y + 1)
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i]!;
    const { x: u, y: v } = dst[i]!;
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve(a, b);
  return [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!, 1];
}

// The homography from a photographed paper (its four corners in photo pixels,
// in any order) onto the paper rectangle [0, width] x [0, height].
export function paperHomography(corners: readonly Vec2[], width: number, height: number): Homography {
  return computeHomography(orderCorners(corners), [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ]);
}

export function applyHomography(h: Homography, p: Vec2): Vec2 {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  };
}

export function invertHomography(h: Homography): Homography {
  const [a, b, c, d, e, f, g, hh, i] = h;
  const A = e * i - f * hh;
  const B = -(d * i - f * g);
  const C = d * hh - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-15) throw new Error('The homography cannot be inverted.');
  const inv = [
    A,
    -(b * i - c * hh),
    b * f - c * e,
    B,
    a * i - c * g,
    -(a * f - c * d),
    C,
    -(a * hh - b * g),
    a * e - b * d,
  ].map((value) => value / det);
  return inv as unknown as Homography;
}

// Straightens the part of `source` inside `corners` (photo pixels, any order)
// into a new `width` x `height` RGBA image: the paper seen square-on. Each
// output pixel is looked up through the inverse transform and sampled
// bilinearly; output pixels that land outside the photo stay transparent.
export function warpPerspective(source: RgbaImage, corners: readonly Vec2[], width: number, height: number): Uint8ClampedArray {
  const toSource = invertHomography(paperHomography(corners, width, height));
  const out = new Uint8ClampedArray(width * height * 4);
  const { data, width: sw, height: sh } = source;
  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = toSource;

  for (let y = 0; y < height; y++) {
    const py = y + 0.5;
    for (let x = 0; x < width; x++) {
      const px = x + 0.5;
      const w = h6 * px + h7 * py + h8;
      const sx = (h0 * px + h1 * py + h2) / w;
      const sy = (h3 * px + h4 * py + h5) / w;
      if (!(sx >= 0 && sy >= 0 && sx <= sw && sy <= sh)) continue;

      // Bilinear, between the four nearest pixel centres (clamped at the edge).
      const fx = sx - 0.5;
      const fy = sy - 0.5;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const xa = clampIndex(x0, sw);
      const xb = clampIndex(x0 + 1, sw);
      const ya = clampIndex(y0, sh);
      const yb = clampIndex(y0 + 1, sh);
      const i00 = (ya * sw + xa) * 4;
      const i10 = (ya * sw + xb) * 4;
      const i01 = (yb * sw + xa) * 4;
      const i11 = (yb * sw + xb) * 4;
      const o = (y * width + x) * 4;
      for (let c = 0; c < 4; c++) {
        const top = data[i00 + c]! * (1 - tx) + data[i10 + c]! * tx;
        const bottom = data[i01 + c]! * (1 - tx) + data[i11 + c]! * tx;
        out[o + c] = Math.round(top * (1 - ty) + bottom * ty);
      }
    }
  }
  return out;
}

function clampIndex(i: number, size: number): number {
  return i < 0 ? 0 : i >= size ? size - 1 : i;
}

function assertNonDegenerate(quad: Quad): void {
  const span = Math.max(
    ...quad.map((p) => Math.abs(p.x)),
    ...quad.map((p) => Math.abs(p.y)),
    1,
  );
  const tolerance = 1e-9 * span * span;
  for (let skip = 0; skip < 4; skip++) {
    const [p, q, r] = quad.filter((_, i) => i !== skip) as [Vec2, Vec2, Vec2];
    const area = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    if (Math.abs(area) <= tolerance) throw new Error('Three of the corners lie in a line.');
  }
}

// Gaussian elimination with partial pivoting.
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row]![col]!) > Math.abs(m[pivot]![col]!)) pivot = row;
    }
    if (Math.abs(m[pivot]![col]!) < 1e-12) throw new Error('The corners do not define a perspective.');
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    const pivotRow = m[col]!;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const target = m[row]!;
      const factor = target[col]! / pivotRow[col]!;
      if (factor === 0) continue;
      for (let k = col; k <= n; k++) target[k] = target[k]! - factor * pivotRow[k]!;
    }
  }
  return m.map((row, i) => row[n]! / row[i]!);
}
