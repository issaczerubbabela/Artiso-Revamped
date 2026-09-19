import { describe, expect, it } from 'vitest';
import {
  CropSchema,
  GridSettingsSchema,
  PaperSchema,
  type GridConfig,
  type Operation,
} from '@artiso/shared-types';
import { foldLegacyCrop, isGuideConfig, migrateLegacyReference } from '../migrate-legacy';
import { orientationOps, orientedDimensions } from '../orientation';
import { defaultFraming } from '../framing';
import { trimToAspect } from '../crop';

// ---------------------------------------------------------------------------
// An independent simulation of what applyGeometryOps does to pixels, on a tiny
// matrix where every cell holds its own coordinates. It follows the canvas
// semantics in apply-geometry-ops.ts (rotate is clockwise; flip mirrors in
// place; crop takes a normalized sub-rectangle of the *current* image).
// applyGeometryOps itself needs OffscreenCanvas, which Node doesn't have.
// ---------------------------------------------------------------------------
type Matrix = number[][]; // rows of columns; each value is y * 1000 + x of the ORIGINAL pixel

const rowsOf = (m: Matrix) => m.length;
const colsOf = (m: Matrix) => m[0]!.length;
const at = (m: Matrix, r: number, c: number) => m[r]![c]!;

function makeMatrix(W: number, H: number): Matrix {
  return Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => y * 1000 + x));
}

function build(rows: number, cols: number, pick: (r: number, c: number) => number): Matrix {
  return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => pick(r, c)));
}

function rotate(m: Matrix, degrees: 0 | 90 | 180 | 270): Matrix {
  const H = rowsOf(m);
  const W = colsOf(m);
  switch (degrees) {
    case 0:
      return m;
    case 90: // clockwise: the top-left corner goes to the top-right
      return build(W, H, (r, c) => at(m, H - 1 - c, r));
    case 180:
      return build(H, W, (r, c) => at(m, H - 1 - r, W - 1 - c));
    case 270: // counter-clockwise: the top-left corner goes to the bottom-left
      return build(W, H, (r, c) => at(m, c, W - 1 - r));
  }
}

function flip(m: Matrix, axis: 'horizontal' | 'vertical'): Matrix {
  const H = rowsOf(m);
  const W = colsOf(m);
  return axis === 'horizontal'
    ? build(H, W, (r, c) => at(m, r, W - 1 - c))
    : build(H, W, (r, c) => at(m, H - 1 - r, c));
}

function cropMatrix(m: Matrix, n: { x: number; y: number; w: number; h: number }): Matrix {
  const H = rowsOf(m);
  const W = colsOf(m);
  const x = Math.round(n.x * W);
  const y = Math.round(n.y * H);
  const w = Math.round(n.w * W);
  const h = Math.round(n.h * H);
  return build(h, w, (r, c) => at(m, y + r, x + c));
}

function applyOps(m: Matrix, ops: readonly Operation[], skipCrops: boolean): Matrix {
  let cur = m;
  for (const op of ops) {
    if (op.type === 'rotate') cur = rotate(cur, op.degrees);
    else if (op.type === 'flip') cur = flip(cur, op.axis);
    else if (op.type === 'crop' && !skipCrops) cur = cropMatrix(cur, op.rect);
  }
  return cur;
}

function subMatrix(m: Matrix, rect: { x: number; y: number; w: number; h: number }): Matrix {
  const x = Math.round(rect.x);
  const y = Math.round(rect.y);
  const w = Math.round(rect.w);
  const h = Math.round(rect.h);
  return build(h, w, (r, c) => at(m, y + r, x + c));
}

const W = 12;
const H = 8;

describe('foldLegacyCrop', () => {
  const cropA: Operation = { type: 'crop', rect: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 } };
  const cropB: Operation = { type: 'crop', rect: { x: 0.5, y: 0, w: 0.5, h: 0.5 } };
  const rotations = [0, 90, 180, 270] as const;
  const flips = [null, 'horizontal', 'vertical'] as const;

  const sequences: Array<[string, (r: 0 | 90 | 180 | 270, f: (typeof flips)[number]) => Operation[]]> = [
    [
      'crop, rotate, flip, crop',
      (r, f) => [cropA, { type: 'rotate', degrees: r }, ...(f ? [{ type: 'flip', axis: f } as const] : []), cropB],
    ],
    [
      'rotate, crop, flip',
      (r, f) => [{ type: 'rotate', degrees: r }, cropA, ...(f ? [{ type: 'flip', axis: f } as const] : [])],
    ],
    [
      'flip, rotate, crop',
      (r, f) => [...(f ? [{ type: 'flip', axis: f } as const] : []), { type: 'rotate', degrees: r }, cropA],
    ],
    [
      'rotate, flip, rotate, crop',
      (r, f) => [
        { type: 'rotate', degrees: r },
        ...(f ? [{ type: 'flip', axis: f } as const] : []),
        { type: 'rotate', degrees: 90 },
        cropA,
      ],
    ],
  ];

  for (const [label, makeOps] of sequences) {
    for (const r of rotations) {
      for (const f of flips) {
        it(`${label} (rotate ${r}, flip ${f ?? 'none'}) selects exactly the pixels the ops would have kept`, () => {
          const ops = makeOps(r, f);
          const original = makeMatrix(W, H);

          const expected = applyOps(original, ops, false);
          const folded = foldLegacyCrop({ width: W, height: H }, ops);
          const oriented = applyOps(original, ops, true);

          // The oriented plane's size matches.
          expect(folded.oriented).toEqual({ width: colsOf(oriented), height: rowsOf(oriented) });
          // And the folded rectangle, cut from the oriented plane, is the same picture.
          expect(subMatrix(oriented, folded.rect)).toEqual(expected);
        });
      }
    }
  }

  it('is the whole image when there are no operations', () => {
    expect(foldLegacyCrop({ width: 300, height: 200 }, [])).toEqual({
      oriented: { width: 300, height: 200 },
      rect: { x: 0, y: 0, w: 300, h: 200 },
    });
  });

  it('ignores adjustments and filters', () => {
    const folded = foldLegacyCrop({ width: 300, height: 200 }, [
      { type: 'brightness', value: 20 },
      { type: 'filter', id: 'grayscale' },
    ]);
    expect(folded.rect).toEqual({ x: 0, y: 0, w: 300, h: 200 });
  });

  it('compounds successive crops', () => {
    const folded = foldLegacyCrop({ width: 1000, height: 1000 }, [
      { type: 'crop', rect: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } },
      { type: 'crop', rect: { x: 0.5, y: 0, w: 0.5, h: 1 } },
    ]);
    expect(folded.rect).toEqual({ x: 750, y: 500, w: 250, h: 500 });
  });
});

describe('orientation helpers', () => {
  const ops: Operation[] = [
    { type: 'crop', rect: { x: 0, y: 0, w: 0.5, h: 0.5 } },
    { type: 'rotate', degrees: 90 },
    { type: 'brightness', value: 5 },
    { type: 'flip', axis: 'horizontal' },
  ];

  it('keeps only rotate and flip, in order', () => {
    expect(orientationOps(ops)).toEqual([
      { type: 'rotate', degrees: 90 },
      { type: 'flip', axis: 'horizontal' },
    ]);
  });

  it('sizes the oriented original, ignoring any legacy crop', () => {
    expect(orientedDimensions({ width: 4000, height: 3000 }, ops)).toEqual({ width: 3000, height: 4000 });
    expect(orientedDimensions({ width: 4000, height: 3000 }, [])).toEqual({ width: 4000, height: 3000 });
  });
});

describe('defaultFraming', () => {
  it('starts on A4 turned to the image with the largest centred crop', () => {
    const { paper, crop } = defaultFraming({ width: 4000, height: 3000 });
    expect(paper).toMatchObject({ preset: 'A4', orientation: 'landscape', widthMm: 297, heightMm: 210 });
    // 4000 x 3000 is narrower than A4 landscape (1.414), so the crop is width-limited.
    expect(crop.w).toBeCloseTo(4000, 9);
    expect(crop.h).toBeCloseTo(4000 / (297 / 210), 9);
    expect(crop.w / crop.h).toBeCloseTo(297 / 210, 12);
    expect(crop.x + crop.w / 2).toBeCloseTo(2000, 9);
    expect(crop.y + crop.h / 2).toBeCloseTo(1500, 9);
    expect(CropSchema.safeParse(crop).success).toBe(true);
    expect(PaperSchema.safeParse(paper).success).toBe(true);
  });
});

const style = { color: '#ff8800', opacity: 70, thickness: 'medium' as const, visible: true };
const rectangular = (over: Partial<Extract<GridConfig, { type: 'rectangular' }>> = {}): GridConfig => ({
  type: 'rectangular',
  rows: 8,
  cols: 8,
  numberingMode: 'off',
  snapToImage: true,
  ...style,
  ...over,
});
const radial = (spokes: number): GridConfig => ({
  type: 'radial',
  centerX: 0.5,
  centerY: 0.5,
  rings: 3,
  spokes,
  ...style,
});
const thirds: GridConfig = { type: 'ruleOfThirds', ...style };
const perspective: GridConfig = {
  type: 'perspective',
  vanishingPointCount: 1,
  horizonY: 0.5,
  lineCount: 12,
  thirdPointPosition: 'above',
  ...style,
};

function migrate(gridConfig: GridConfig, extra: Partial<Parameters<typeof migrateLegacyReference>[0]> = {}) {
  return migrateLegacyReference({
    original: { width: 3000, height: 2000 },
    editStack: [],
    gridConfig,
    secondaryGridConfig: null,
    ...extra,
  });
}

describe('migrateLegacyReference: paper and crop', () => {
  it('picks A4 landscape for a wide image and portrait for a tall one', () => {
    expect(migrate(rectangular()).paper).toMatchObject({ preset: 'A4', orientation: 'landscape', widthMm: 297 });
    expect(
      migrate(rectangular(), { original: { width: 2000, height: 3000 } }).paper,
    ).toMatchObject({ preset: 'A4', orientation: 'portrait', widthMm: 210 });
  });

  it('turns the legacy crop into an aspect-locked crop trimmed centred to the paper ratio', () => {
    const { paper, crop, oriented } = migrate(rectangular());
    expect(oriented).toEqual({ width: 3000, height: 2000 });
    expect(crop.w / crop.h).toBeCloseTo(paper.widthMm / paper.heightMm, 12);
    // 3000 x 2000 is wider than A4 landscape, so the height is kept and the sides trimmed evenly.
    expect(crop.h).toBeCloseTo(2000, 9);
    expect(crop.x).toBeCloseTo((3000 - crop.w) / 2, 9);
    expect(crop.y).toBeCloseTo(0, 9);
  });

  it('uses a legacy crop (through rotate) as the starting point', () => {
    const editStack: Operation[] = [
      { type: 'crop', rect: { x: 0, y: 0, w: 0.5, h: 1 } }, // left half: 1500 x 2000 (portrait)
      { type: 'rotate', degrees: 90 },
    ];
    const result = migrate(rectangular(), { editStack });
    // Rotated 90: oriented plane is 2000 x 3000 and the kept region is 2000 x 1500 (landscape).
    expect(result.oriented).toEqual({ width: 2000, height: 3000 });
    expect(result.paper.orientation).toBe('landscape');
    expect(result.crop.w / result.crop.h).toBeCloseTo(297 / 210, 12);
    expect(result.crop.x + result.crop.w).toBeLessThanOrEqual(2000 + 1e-9);
    expect(result.crop.y + result.crop.h).toBeLessThanOrEqual(3000 + 1e-9);
  });

  it('keeps the crop inside the oriented original', () => {
    const editStack: Operation[] = [
      { type: 'crop', rect: { x: 0.1, y: 0.2, w: 0.7, h: 0.6 } },
      { type: 'flip', axis: 'horizontal' },
      { type: 'rotate', degrees: 270 },
    ];
    const { crop, oriented } = migrate(rectangular(), { editStack });
    expect(crop.x).toBeGreaterThanOrEqual(-1e-9);
    expect(crop.y).toBeGreaterThanOrEqual(-1e-9);
    expect(crop.x + crop.w).toBeLessThanOrEqual(oriented.width + 1e-9);
    expect(crop.y + crop.h).toBeLessThanOrEqual(oriented.height + 1e-9);
  });

  it('produces values that satisfy the schemas', () => {
    const result = migrate(rectangular({ numberingMode: 'numbers' }));
    expect(PaperSchema.safeParse(result.paper).success).toBe(true);
    expect(CropSchema.safeParse(result.crop).success).toBe(true);
    expect(GridSettingsSchema.safeParse(result.gridSettings).success).toBe(true);
  });
});

describe('migrateLegacyReference: a rectangular primary grid', () => {
  it('approximates the old cell count with a square cell, and keeps the style', () => {
    const { gridSettings } = migrate(rectangular({ cols: 8, rows: 8, opacity: 70, thickness: 'medium' }));
    // A4 landscape is 297 wide: 297 / 8 = 37.1 -> 37 mm.
    expect(gridSettings.cellMm).toBe(37);
    expect(gridSettings.showSquares).toBe(true);
    expect(gridSettings.showDiagonals).toBe(false);
    expect(gridSettings.showRadial).toBe(false);
    expect(gridSettings.style).toEqual({ color: '#ff8800', widthPx: 1.5, opacity: 0.7 });
    expect(gridSettings.marginMm).toBe(0);
  });

  it('never yields a cell smaller than 1 mm', () => {
    expect(migrate(rectangular({ cols: 5000 })).gridSettings.cellMm).toBe(1);
  });

  it.each([
    ['veryThin', 0.5],
    ['thin', 1],
    ['medium', 1.5],
    ['thick', 2.5],
    ['extraThick', 4],
  ] as const)('maps the %s thickness to %s px', (thickness, widthPx) => {
    expect(migrate(rectangular({ thickness })).gridSettings.style.widthPx).toBe(widthPx);
  });

  it('rescales opacity from 0..100 to 0..1', () => {
    expect(migrate(rectangular({ opacity: 0 })).gridSettings.style.opacity).toBe(0);
    expect(migrate(rectangular({ opacity: 100 })).gridSettings.style.opacity).toBe(1);
    expect(migrate(rectangular({ opacity: 35 })).gridSettings.style.opacity).toBeCloseTo(0.35, 12);
  });

  it.each([
    ['off', false, 'letters', 'numbers'],
    ['custom', false, 'letters', 'numbers'],
    ['numbers', true, 'numbers', 'numbers'],
    ['roman', true, 'numbers', 'numbers'],
    ['letters', true, 'letters', 'numbers'],
    ['alphanumeric', true, 'letters', 'numbers'],
  ] as const)('maps numbering %s to labels enabled=%s (%s x %s)', (numberingMode, enabled, columns, rows) => {
    expect(migrate(rectangular({ numberingMode })).gridSettings.labels).toEqual({ enabled, columns, rows });
  });

  it('keeps a hidden grid hidden', () => {
    const { gridSettings } = migrate(rectangular({ visible: false, numberingMode: 'numbers' }));
    expect(gridSettings.showSquares).toBe(false);
    expect(gridSettings.labels.enabled).toBe(false);
  });
});

describe('migrateLegacyReference: a radial primary grid', () => {
  it.each([
    [12, 30],
    [24, 15],
    [100, 4],
    [48, 8], // 7.5 rounds up
    [2, 90], // 180 clamps to the 90 degree maximum
    [1, 90],
  ])('maps %s spokes to a %s degree step', (spokes, step) => {
    expect(migrate(radial(spokes)).gridSettings.radialStepDeg).toBe(step);
  });

  it('shows only the radial overlay with no labels', () => {
    const { gridSettings } = migrate(radial(12));
    expect(gridSettings.showRadial).toBe(true);
    expect(gridSettings.showSquares).toBe(false);
    expect(gridSettings.labels.enabled).toBe(false);
  });
});

describe('migrateLegacyReference: the Guides layer', () => {
  it('promotes a guide primary grid to the Guides layer and starts the new grid empty', () => {
    const result = migrate(thirds);
    expect(result.secondaryGridConfig).toEqual(thirds);
    expect(result.gridSettings.showSquares).toBe(false);
    expect(result.gridSettings.labels.enabled).toBe(false);
  });

  it('keeps an existing guide and drops a guide primary that has nowhere to go', () => {
    expect(migrate(thirds, { secondaryGridConfig: perspective }).secondaryGridConfig).toEqual(perspective);
  });

  it('keeps a layered guide under a rectangular primary grid', () => {
    expect(migrate(rectangular(), { secondaryGridConfig: thirds }).secondaryGridConfig).toEqual(thirds);
  });

  it('drops a layered rectangular or radial guide (those types are no longer guides)', () => {
    expect(migrate(rectangular(), { secondaryGridConfig: rectangular() }).secondaryGridConfig).toBeNull();
    expect(migrate(rectangular(), { secondaryGridConfig: radial(12) }).secondaryGridConfig).toBeNull();
  });

  it('classifies guide configs', () => {
    expect(isGuideConfig(thirds)).toBe(true);
    expect(isGuideConfig(perspective)).toBe(true);
    expect(isGuideConfig({ type: 'goldenRatio', orientation: 'both', ...style })).toBe(true);
    expect(isGuideConfig(rectangular())).toBe(false);
    expect(isGuideConfig(radial(12))).toBe(false);
  });
});

describe('trimToAspect', () => {
  it('keeps the centre and shrinks the longer side', () => {
    const trimmed = trimToAspect({ x: 100, y: 50, w: 1000, h: 400 }, 1);
    expect(trimmed).toEqual({ x: 400, y: 50, w: 400, h: 400 });
    const tall = trimToAspect({ x: 0, y: 0, w: 400, h: 1000 }, 2);
    expect(tall).toEqual({ x: 0, y: 400, w: 400, h: 200 });
  });

  it('is the rect itself when the aspect already matches', () => {
    expect(trimToAspect({ x: 5, y: 6, w: 200, h: 100 }, 2)).toEqual({ x: 5, y: 6, w: 200, h: 100 });
  });
});
