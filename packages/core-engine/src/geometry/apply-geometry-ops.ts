import type { Operation } from '@artiso/shared-types';
import { denormalizeCropRect } from './crop-rect';

export interface GeometryResult {
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

// Replays the geometry-affecting subset of an EditStack (crop, rotate, flip),
// in order, against a source bitmap. Used identically by the interactive
// renderer (against the working bitmap) and by Export (against the full-res
// original) -- see .agents/workflows/build-export-pipeline.md's "re-run,
// don't reimplement" rule. Brightness/contrast/saturation/filter ops are
// skipped: those are the WebGL pipeline's job, not geometry's.
//
// Needs OffscreenCanvas/ImageBitmap, so it can't run under Vitest's Node
// environment -- exercised via the Playwright E2E golden path instead.
export async function applyGeometryOps(
  source: ImageBitmap,
  ops: readonly Operation[],
): Promise<GeometryResult> {
  let bitmap = source;
  let width = source.width;
  let height = source.height;

  for (const op of ops) {
    switch (op.type) {
      case 'crop': {
        const rect = denormalizeCropRect(op.rect, width, height);
        const next = await drawToBitmap(rect.w, rect.h, (ctx) => {
          ctx.drawImage(bitmap, -rect.x, -rect.y);
        });
        replace(next);
        width = rect.w;
        height = rect.h;
        break;
      }
      case 'rotate': {
        if (op.degrees === 0) break;
        const swapped = op.degrees === 90 || op.degrees === 270;
        const nextWidth = swapped ? height : width;
        const nextHeight = swapped ? width : height;
        const next = await drawToBitmap(nextWidth, nextHeight, (ctx) => {
          ctx.translate(nextWidth / 2, nextHeight / 2);
          ctx.rotate((op.degrees * Math.PI) / 180);
          ctx.drawImage(bitmap, -width / 2, -height / 2);
        });
        replace(next);
        width = nextWidth;
        height = nextHeight;
        break;
      }
      case 'flip': {
        const w = width;
        const h = height;
        const next = await drawToBitmap(w, h, (ctx) => {
          if (op.axis === 'horizontal') {
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
          } else {
            ctx.translate(0, h);
            ctx.scale(1, -1);
          }
          ctx.drawImage(bitmap, 0, 0);
        });
        replace(next);
        break;
      }
      default:
        break;
    }
  }

  function replace(next: ImageBitmap) {
    if (bitmap !== source) bitmap.close();
    bitmap = next;
  }

  return { bitmap, width, height };
}

async function drawToBitmap(
  width: number,
  height: number,
  draw: (ctx: OffscreenCanvasRenderingContext2D) => void,
): Promise<ImageBitmap> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D context unavailable');
  draw(ctx);
  return createImageBitmap(canvas);
}
