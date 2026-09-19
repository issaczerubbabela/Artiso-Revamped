import type { Operation } from '@artiso/shared-types';
import { applyGeometryOps, type PixelRect } from '../geometry';
import { DEFAULT_WORKING_LONG_EDGE } from '../import/constants';
import { computeResizeDimensions } from '../import/validation';
import { orientationOps } from './orientation';

export interface FramedBitmap {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  /** The size of the original after rotate/flip -- the space a crop is measured in. */
  orientedWidth: number;
  orientedHeight: number;
}

// Renders a region of the *oriented original* to a bitmap: the original is
// rotated/flipped by the EditStack's orientation operations, then `region`
// (pixels of that oriented image; the whole image when omitted) is drawn scaled
// down so its long edge is at most `longEdge`. Nothing here modifies the
// original, and crop is never an EditStack operation -- it is this region
// (docs/phases/phase-9-drawing-grid-overhaul.md).
//
// Used for the interactive working bitmap (longEdge 2048, the region being the
// crop, so a small crop of a big photo stays sharp), for the crop tool's
// whole-image preview, and for export (longEdge Infinity: native resolution).
//
// Needs OffscreenCanvas/ImageBitmap, so it can't run under Vitest's Node
// environment -- exercised via the Playwright E2E golden path instead.
export async function renderFramedBitmap(
  original: ImageBitmap,
  ops: readonly Operation[],
  region: PixelRect | null,
  longEdge: number = DEFAULT_WORKING_LONG_EDGE,
): Promise<FramedBitmap> {
  const orientation = orientationOps(ops);
  const oriented =
    orientation.length > 0
      ? await applyGeometryOps(original, orientation)
      : { bitmap: original, width: original.width, height: original.height };

  try {
    // Whole pixels, kept inside the image: a fractional or overhanging crop
    // (float maths, an orientation swap) must not sample outside it.
    const source = region ?? { x: 0, y: 0, w: oriented.width, h: oriented.height };
    const sx = clamp(Math.round(source.x), 0, oriented.width - 1);
    const sy = clamp(Math.round(source.y), 0, oriented.height - 1);
    const sw = clamp(Math.round(source.w), 1, oriented.width - sx);
    const sh = clamp(Math.round(source.h), 1, oriented.height - sy);

    const { width, height } = computeResizeDimensions(sw, sh, longEdge);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(oriented.bitmap, sx, sy, sw, sh, 0, 0, width, height);

    return {
      bitmap: await createImageBitmap(canvas),
      width,
      height,
      orientedWidth: oriented.width,
      orientedHeight: oriented.height,
    };
  } finally {
    if (oriented.bitmap !== original) oriented.bitmap.close();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
