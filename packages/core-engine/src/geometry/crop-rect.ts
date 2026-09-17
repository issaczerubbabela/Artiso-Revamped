export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface NormalizedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Crop rects are stored normalized (0-1, image-space) in the EditStack so the
// exact same operation replays correctly against the working bitmap
// (interactive) or the full-resolution original (Export) -- see
// docs/architecture/02-image-editing.md and ki-non-destructive-editing.
export function normalizeCropRect(rect: PixelRect, imageWidth: number, imageHeight: number): NormalizedRect {
  return {
    x: rect.x / imageWidth,
    y: rect.y / imageHeight,
    w: rect.w / imageWidth,
    h: rect.h / imageHeight,
  };
}

export function denormalizeCropRect(rect: NormalizedRect, imageWidth: number, imageHeight: number): PixelRect {
  return {
    x: Math.round(rect.x * imageWidth),
    y: Math.round(rect.y * imageHeight),
    w: Math.round(rect.w * imageWidth),
    h: Math.round(rect.h * imageHeight),
  };
}
