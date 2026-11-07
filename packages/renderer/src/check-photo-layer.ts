import { viewMatrix, type ViewportState } from './viewport';

type Canvas2DContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

// What the Drawing Check shows (GLOSSARY.md). Pure view state: it is never
// saved on the reference, never in the EditStack, never exported.
export interface CheckPhotoView {
  // How strongly the Check Photo covers the reference, 0..1.
  opacity: number;
  // Press-and-hold: only the Check Photo, the reference hidden beneath it.
  holding: boolean;
}

// The alpha the Check Photo is drawn at. Holding shows the photo alone, so it
// is drawn fully opaque over the reference (the straightened photo covers the
// whole paper, so nothing of the reference shows through).
export function checkPhotoAlpha(view: CheckPhotoView): number {
  if (view.holding) return 1;
  return Math.min(1, Math.max(0, Number.isFinite(view.opacity) ? view.opacity : 0));
}

// The Check Photo layer: its own canvas, stacked between the reference image
// and the grid, so the grid always stays on top of the comparison. Draws the
// already-straightened photo (paper-shaped, see core-engine's
// warpPerspective) over the paper rectangle through the one view transform,
// so it pans, zooms and follows View Rotation exactly with the reference.
// Never touches the image pipeline or the grid (ki-grid-image-independence).
export class CheckPhotoLayer {
  private readonly ctx: Canvas2DContext;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    const ctx = canvas.getContext('2d') as Canvas2DContext | null;
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
  }

  draw(
    photo: CanvasImageSource | null,
    paper: { widthMm: number; heightMm: number },
    view: CheckPhotoView,
    viewport: ViewportState,
    canvasWidth: number,
    canvasHeight: number,
    pixelRatio = 1,
  ): void {
    const ctx = this.ctx;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    const alpha = checkPhotoAlpha(view);
    if (!photo || alpha <= 0) return;

    ctx.save();
    const m = viewMatrix(viewport);
    ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(photo, 0, 0, paper.widthMm, paper.heightMm);
    ctx.restore();
  }

  clear(canvasWidth: number, canvasHeight: number, pixelRatio = 1): void {
    this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  }
}
