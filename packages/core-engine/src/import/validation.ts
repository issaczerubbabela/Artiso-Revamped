import { ACCEPTED_MIME_TYPES, MAX_SOURCE_DIMENSION_PX } from './constants';
import { ImageImportError } from './errors';

export function validateMimeType(mimeType: string): void {
  if (!ACCEPTED_MIME_TYPES.includes(mimeType as (typeof ACCEPTED_MIME_TYPES)[number])) {
    throw new ImageImportError(
      'unsupported-format',
      `Unsupported image format "${mimeType}". Accepted formats: ${ACCEPTED_MIME_TYPES.join(', ')}.`,
    );
  }
}

export function validateSourceDimensions(width: number, height: number): void {
  if (width > MAX_SOURCE_DIMENSION_PX || height > MAX_SOURCE_DIMENSION_PX) {
    throw new ImageImportError(
      'oversized',
      `Image is ${width}x${height}px, which exceeds the maximum of ${MAX_SOURCE_DIMENSION_PX}px per side.`,
    );
  }
}

// Never upscales -- an image already smaller than targetLongEdge keeps its
// original dimensions.
export function computeResizeDimensions(
  sourceWidth: number,
  sourceHeight: number,
  targetLongEdge: number,
): { width: number; height: number } {
  const longEdge = Math.max(sourceWidth, sourceHeight);
  const scale = Math.min(1, targetLongEdge / longEdge);
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}
