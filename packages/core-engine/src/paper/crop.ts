import type { PixelRect } from '../geometry';

// Crop math for the "image under a fixed paper frame" tool
// (Grid-Feature-Spec.md §5). All rectangles here are in pixels of the oriented
// original, kept as floats so the crop's aspect ratio stays exactly the
// paper's; rounding happens only when pixels are actually extracted.

/** The largest rectangle of the given aspect (w / h) that fits the image, centred. */
export function initialCrop(imageWidth: number, imageHeight: number, aspect: number): PixelRect {
  const w = Math.min(imageWidth, imageHeight * aspect);
  const h = w / aspect;
  return { x: (imageWidth - w) / 2, y: (imageHeight - h) / 2, w, h };
}

/** The largest rectangle of the given aspect that fits inside `rect`, sharing its centre. */
export function trimToAspect(rect: PixelRect, aspect: number): PixelRect {
  const w = Math.min(rect.w, rect.h * aspect);
  const h = w / aspect;
  return { x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w, h };
}

/** Shrinks (keeping aspect) if the crop is bigger than the image, then slides it fully inside. */
export function clampCrop(crop: PixelRect, imageWidth: number, imageHeight: number): PixelRect {
  const aspect = crop.w / crop.h;
  let { w, h } = crop;
  if (w > imageWidth) {
    w = imageWidth;
    h = w / aspect;
  }
  if (h > imageHeight) {
    h = imageHeight;
    w = h * aspect;
  }
  const x = Math.min(Math.max(crop.x, 0), imageWidth - w);
  const y = Math.min(Math.max(crop.y, 0), imageHeight - h);
  return { x, y, w, h };
}

/**
 * Re-fits a crop to a new paper aspect (portrait <-> landscape or another
 * preset): same centre, same area, then re-clamped so it stays inside the
 * image. Swapping orientation therefore turns a w x h crop into an h x w one.
 */
export function recenterCrop(crop: PixelRect, newAspect: number, imageWidth: number, imageHeight: number): PixelRect {
  const cx = crop.x + crop.w / 2;
  const cy = crop.y + crop.h / 2;
  const w = Math.sqrt(crop.w * crop.h * newAspect);
  const h = w / newAspect;
  return clampCrop({ x: cx - w / 2, y: cy - h / 2, w, h }, imageWidth, imageHeight);
}

/** How far the user may zoom the image beyond "just covers the frame". */
export const MAX_CROP_ZOOM = 16;

/** The fixed frame the crop is measured through, in the crop tool's screen space. */
export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The image's transform in the crop tool: `screen = image * scale + (tx, ty)`. */
export interface ImageView {
  scale: number;
  tx: number;
  ty: number;
}

/** The largest frame of the given aspect that fits the viewport with a margin, centred. */
export function frameInViewport(viewportWidth: number, viewportHeight: number, aspect: number, margin: number): FrameRect {
  const availW = Math.max(1, viewportWidth - margin * 2);
  const availH = Math.max(1, viewportHeight - margin * 2);
  const w = Math.min(availW, availH * aspect);
  const h = w / aspect;
  return { x: (viewportWidth - w) / 2, y: (viewportHeight - h) / 2, w, h };
}

/** The smallest image scale at which the image still fully covers the frame. */
export function coverScale(imageWidth: number, imageHeight: number, frame: FrameRect): number {
  return Math.max(frame.w / imageWidth, frame.h / imageHeight);
}

/**
 * Keeps the frame fully covered by the image: clamps the zoom to
 * [cover, cover * MAX_CROP_ZOOM] and the pan so no frame edge leaves the image.
 */
export function clampImageToFrame(view: ImageView, imageWidth: number, imageHeight: number, frame: FrameRect): ImageView {
  const min = coverScale(imageWidth, imageHeight, frame);
  const scale = Math.min(Math.max(view.scale, min), min * MAX_CROP_ZOOM);
  // The image's left edge (tx) must be at or left of the frame's left edge, and
  // its right edge (tx + width) at or right of the frame's right edge.
  const tx = Math.min(Math.max(view.tx, frame.x + frame.w - imageWidth * scale), frame.x);
  const ty = Math.min(Math.max(view.ty, frame.y + frame.h - imageHeight * scale), frame.y);
  return { scale, tx, ty };
}

/** Reads the crop rectangle (image pixels) currently visible through the frame. */
export function cropFromView(view: ImageView, frame: FrameRect): PixelRect {
  return {
    x: (frame.x - view.tx) / view.scale,
    y: (frame.y - view.ty) / view.scale,
    w: frame.w / view.scale,
    h: frame.h / view.scale,
  };
}

/** The image transform that shows exactly `crop` through `frame`. */
export function viewFromCrop(crop: PixelRect, frame: FrameRect): ImageView {
  const scale = frame.w / crop.w;
  return { scale, tx: frame.x - crop.x * scale, ty: frame.y - crop.y * scale };
}
