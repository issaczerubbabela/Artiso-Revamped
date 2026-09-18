import type { GridGeometry } from '@artiso/core-engine';
import type { GridConfig } from '@artiso/shared-types';
import type { ViewportState } from './viewport';

// Screen-space pixel widths -- kept constant regardless of zoom (divided by
// viewport.scale before drawing) so grid lines and labels stay crisp and
// legible rather than growing/shrinking with the image, matching why this
// layer is Canvas2D rather than a WebGL texture in the first place (see
// docs/architecture/04-grid-engine.md).
const THICKNESS_PX: Record<GridConfig['thickness'], number> = {
  veryThin: 0.5,
  thin: 1,
  medium: 1.5,
  thick: 2.5,
  extraThick: 4,
};

const LABEL_FONT_PX = 14;

type Canvas2DContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

// Canvas2D grid layer: the top canvas of the two-canvas compositor. Draws
// cached GridGeometry (image-space) reprojected through the current Viewport
// transform every frame -- the geometry itself is never recomputed for
// pan/zoom (ki-grid-image-independence).
export class GridLayer {
  private readonly ctx: Canvas2DContext;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    const ctx = canvas.getContext('2d') as Canvas2DContext | null;
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
  }

  draw(
    geometry: GridGeometry,
    config: Pick<GridConfig, 'visible' | 'color' | 'opacity' | 'thickness'>,
    viewport: ViewportState,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    if (!config.visible) return;

    ctx.save();
    ctx.translate(viewport.translateX, viewport.translateY);
    ctx.scale(viewport.scale, viewport.scale);

    ctx.globalAlpha = config.opacity / 100;
    ctx.strokeStyle = config.color;
    ctx.lineWidth = THICKNESS_PX[config.thickness] / viewport.scale;

    for (const line of geometry.lines) {
      ctx.beginPath();
      ctx.moveTo(line.x1, line.y1);
      ctx.lineTo(line.x2, line.y2);
      ctx.stroke();
    }

    // Whether labels exist at all is the grid engine's decision (only the
    // rectangular type generates any, and only when numberingMode isn't
    // 'off'/'custom') -- the renderer just draws whatever geometry.labels
    // contains, never re-deciding based on config shape.
    if (geometry.labels.length > 0) {
      ctx.fillStyle = config.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${LABEL_FONT_PX / viewport.scale}px system-ui, sans-serif`;
      for (const label of geometry.labels) {
        ctx.fillText(label.text, label.x, label.y);
      }
    }

    ctx.restore();
  }
}
