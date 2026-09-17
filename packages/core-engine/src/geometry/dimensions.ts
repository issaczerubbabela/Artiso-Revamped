import type { Operation } from '@artiso/shared-types';

export interface Dimensions {
  width: number;
  height: number;
}

// Pure function of the geometry-affecting subset of an EditStack (crop,
// rotate, flip) and the source dimensions -- this is what the Grid Engine
// needs to know the working-bitmap dimensions without ever touching pixels.
// Adjustment/filter operations are skipped entirely: they never change
// dimensions and must never trigger this recomputing (ki-grid-image-independence).
export function computeGeometryDimensions(source: Dimensions, ops: readonly Operation[]): Dimensions {
  let { width, height } = source;

  for (const op of ops) {
    switch (op.type) {
      case 'crop':
        width = Math.max(1, Math.round(op.rect.w * width));
        height = Math.max(1, Math.round(op.rect.h * height));
        break;
      case 'rotate':
        if (op.degrees === 90 || op.degrees === 270) {
          [width, height] = [height, width];
        }
        break;
      case 'flip':
        // Flipping never changes dimensions.
        break;
      default:
        // brightness / contrast / saturation / filter: not geometry.
        break;
    }
  }

  return { width, height };
}
