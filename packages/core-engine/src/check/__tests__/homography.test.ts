import { describe, expect, it } from 'vitest';
import {
  applyHomography,
  computeHomography,
  invertHomography,
  orderCorners,
  paperHomography,
  warpPerspective,
  type Quad,
} from '../homography';

const close = (a: { x: number; y: number }, b: { x: number; y: number }, digits = 6) => {
  expect(a.x).toBeCloseTo(b.x, digits);
  expect(a.y).toBeCloseTo(b.y, digits);
};

// A paper photographed at an angle: a convex, clearly non-rectangular quad,
// listed top-left, top-right, bottom-right, bottom-left.
const PHOTO_QUAD: Quad = [
  { x: 120, y: 80 },
  { x: 910, y: 140 },
  { x: 980, y: 1210 },
  { x: 60, y: 1150 },
];

describe('orderCorners', () => {
  it('returns top-left, top-right, bottom-right, bottom-left whatever order the corners were tapped in', () => {
    const [tl, tr, br, bl] = PHOTO_QUAD;
    const orders: Quad[] = [
      [tl, tr, br, bl],
      [br, bl, tl, tr],
      [tr, tl, bl, br],
      [bl, br, tr, tl],
      [tl, br, tr, bl],
    ];
    for (const order of orders) expect(orderCorners(order)).toEqual(PHOTO_QUAD);
  });

  it('orders a paper photographed slightly turned', () => {
    // Rotated ~10 degrees clockwise about its centre.
    const turned: Quad = [
      { x: 200, y: 100 },
      { x: 700, y: 190 },
      { x: 610, y: 690 },
      { x: 110, y: 600 },
    ];
    expect(orderCorners([turned[2], turned[0], turned[3], turned[1]])).toEqual(turned);
  });
});

describe('computeHomography', () => {
  it('maps each source corner exactly onto its destination corner', () => {
    const dst: Quad = [
      { x: 0, y: 0 },
      { x: 210, y: 0 },
      { x: 210, y: 297 },
      { x: 0, y: 297 },
    ];
    const h = computeHomography(PHOTO_QUAD, dst);
    PHOTO_QUAD.forEach((p, i) => close(applyHomography(h, p), dst[i]!));
  });

  it('is the identity for identical quads', () => {
    const h = computeHomography(PHOTO_QUAD, PHOTO_QUAD);
    close(applyHomography(h, { x: 400, y: 500 }), { x: 400, y: 500 });
  });

  it('round-trips through its inverse anywhere inside the quad', () => {
    const h = paperHomography(PHOTO_QUAD, 210, 297);
    const inverse = invertHomography(h);
    for (const p of [
      { x: 500, y: 600 },
      { x: 200, y: 300 },
      { x: 900, y: 1100 },
    ]) {
      close(applyHomography(inverse, applyHomography(h, p)), p, 5);
    }
  });

  it('maps the quad centre (diagonal crossing) to the paper centre, as perspective requires', () => {
    // The diagonals of the photographed quad cross at the image of the paper's
    // centre -- a property a plain affine fit would get wrong.
    const quad: Quad = [
      { x: 0, y: 0 },
      { x: 100, y: 20 },
      { x: 100, y: 80 },
      { x: 0, y: 100 },
    ];
    const h = paperHomography(quad, 1, 1);
    // Diagonals (0,0)-(100,80) and (100,20)-(0,100) meet at (62.5, 50).
    close(applyHomography(h, { x: 62.5, y: 50 }), { x: 0.5, y: 0.5 });
  });

  it('throws for a degenerate quad (three corners in a line)', () => {
    const flat: Quad = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
    ];
    expect(() => computeHomography(flat, PHOTO_QUAD)).toThrow();
  });
});

describe('paperHomography', () => {
  it('orders the corners itself, so the tap order never flips or turns the result', () => {
    const shuffled: Quad = [PHOTO_QUAD[2], PHOTO_QUAD[0], PHOTO_QUAD[3], PHOTO_QUAD[1]];
    const h = paperHomography(shuffled, 210, 297);
    close(applyHomography(h, PHOTO_QUAD[0]), { x: 0, y: 0 });
    close(applyHomography(h, PHOTO_QUAD[1]), { x: 210, y: 0 });
    close(applyHomography(h, PHOTO_QUAD[2]), { x: 210, y: 297 });
    close(applyHomography(h, PHOTO_QUAD[3]), { x: 0, y: 297 });
  });
});

describe('warpPerspective', () => {
  // A 4x4 source: left half red, right half blue.
  function source(): { data: Uint8ClampedArray; width: number; height: number } {
    const width = 4;
    const height = 4;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        data[i] = x < 2 ? 255 : 0;
        data[i + 2] = x < 2 ? 0 : 255;
        data[i + 3] = 255;
      }
    }
    return { data, width, height };
  }

  const pixel = (out: Uint8ClampedArray, width: number, x: number, y: number) =>
    Array.from(out.slice((y * width + x) * 4, (y * width + x) * 4 + 4));

  it('straightens the quad into the output rectangle', () => {
    const quad: Quad = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    const out = warpPerspective(source(), quad, 8, 8);
    expect(pixel(out, 8, 1, 4)).toEqual([255, 0, 0, 255]);
    expect(pixel(out, 8, 6, 4)).toEqual([0, 0, 255, 255]);
  });

  it('flips nothing when the corners were tapped in another order', () => {
    const quad: Quad = [
      { x: 0, y: 4 },
      { x: 4, y: 4 },
      { x: 4, y: 0 },
      { x: 0, y: 0 },
    ];
    const out = warpPerspective(source(), quad, 8, 8);
    expect(pixel(out, 8, 1, 4)).toEqual([255, 0, 0, 255]);
    expect(pixel(out, 8, 6, 4)).toEqual([0, 0, 255, 255]);
  });

  it('leaves pixels that fall outside the photo transparent', () => {
    // A quad reaching past the photo's right edge.
    const quad: Quad = [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 8, y: 4 },
      { x: 0, y: 4 },
    ];
    const out = warpPerspective(source(), quad, 8, 4);
    expect(pixel(out, 8, 7, 2)[3]).toBe(0);
    expect(pixel(out, 8, 0, 2)[3]).toBe(255);
  });
});
