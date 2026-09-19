type Canvas2DContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface CropFrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CropFrameStyle {
  // Colour of the frame outline (the app's interactive accent).
  outline?: string;
  // How strongly the image outside the frame is dimmed, 0..1.
  dim?: number;
}

export const CROP_DIM_DEFAULT = 0.55;
export const CROP_OUTLINE_DEFAULT = '#34e2e2';
export const CROP_OUTLINE_WIDTH_PX = 2;

// The Paper & crop tool's frame (Grid-Feature-Spec.md §5): the paper-shaped
// window the image is panned and zoomed beneath. Everything outside it is
// dimmed so what will be kept is obvious, and the frame gets an outline. Draws
// on an already-cleared 2D context, in CSS px (the caller has set the
// pixel-ratio transform); it never moves the frame -- the image moves under it.
export function drawCropFrame(
  ctx: Canvas2DContext,
  width: number,
  height: number,
  frame: CropFrameRect,
  style: CropFrameStyle = {},
): void {
  const right = frame.x + frame.w;
  const bottom = frame.y + frame.h;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(0, 0, 0, ${style.dim ?? CROP_DIM_DEFAULT})`;
  // Four rectangles around the frame rather than an even-odd clip: no path
  // state to restore and no seam at the frame edge.
  ctx.fillRect(0, 0, width, frame.y);
  ctx.fillRect(0, bottom, width, height - bottom);
  ctx.fillRect(0, frame.y, frame.x, frame.h);
  ctx.fillRect(right, frame.y, width - right, frame.h);

  ctx.strokeStyle = style.outline ?? CROP_OUTLINE_DEFAULT;
  ctx.lineWidth = CROP_OUTLINE_WIDTH_PX;
  // Inset by half the line so the outline sits just inside the kept area.
  const inset = CROP_OUTLINE_WIDTH_PX / 2;
  ctx.strokeRect(frame.x + inset, frame.y + inset, frame.w - CROP_OUTLINE_WIDTH_PX, frame.h - CROP_OUTLINE_WIDTH_PX);
  ctx.restore();
}
