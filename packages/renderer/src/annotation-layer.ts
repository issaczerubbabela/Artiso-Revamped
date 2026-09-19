import type { ResolvedAnnotation } from '@artiso/core-engine';
import type { ViewportState } from './viewport';

type Canvas2DContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const THICKNESS_PX: Record<'thin' | 'medium' | 'thick', number> = {
  thin: 1.5,
  medium: 3,
  thick: 5,
};

const ARROWHEAD_LENGTH_PX = 12;
const ARROWHEAD_ANGLE = Math.PI / 7;
const NOTE_MARKER_RADIUS_PX = 5;
const NOTE_FONT_PX = 13;

// Canvas2D annotation layer: the third stacked canvas (docs/architecture/05-
// canvas-renderer.md's "input-source-agnostic Viewport" note is what this
// module cashes in). Draws already-resolved (image-space pixel) annotations
// reprojected through the current Viewport transform, same contract as
// GridLayer -- this layer has no idea what normalized coordinates or
// crop/rotate are, it just draws shapes.
//
// `draft` is the annotation currently being drawn (if any), rendered with
// the same code path as committed annotations so the live preview while
// dragging is pixel-identical to what gets saved -- apps/web owns the
// pointer-capture logic that builds `draft` and calls this every frame.
export class AnnotationLayer {
  private readonly ctx: Canvas2DContext;

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
    const ctx = canvas.getContext('2d') as Canvas2DContext | null;
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
  }

  draw(
    annotations: ResolvedAnnotation[],
    draft: ResolvedAnnotation | null,
    viewport: ViewportState,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    ctx.save();
    ctx.translate(viewport.translateX, viewport.translateY);
    ctx.scale(viewport.scale, viewport.scale);

    for (const annotation of annotations) this.drawOne(annotation, viewport.scale);
    if (draft) this.drawOne(draft, viewport.scale, 0.7);

    ctx.restore();
  }

  private drawOne(annotation: ResolvedAnnotation, scale: number, alpha = 1): void {
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = annotation.color;
    ctx.fillStyle = annotation.color;

    switch (annotation.type) {
      case 'arrow': {
        ctx.lineWidth = THICKNESS_PX[annotation.thickness] / scale;
        this.drawArrow(annotation.start, annotation.end, scale);
        break;
      }
      case 'circle': {
        ctx.lineWidth = THICKNESS_PX[annotation.thickness] / scale;
        ctx.beginPath();
        ctx.ellipse(annotation.centerX, annotation.centerY, annotation.radiusX, annotation.radiusY, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'freehand': {
        // Pressure is captured per-point in the data model (for a future
        // variable-width stroke refinement) but not yet used to vary the
        // rendered width -- a single fixed-thickness path is a reasonable
        // first cut and keeps this loop simple.
        ctx.lineWidth = THICKNESS_PX[annotation.thickness] / scale;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        annotation.points.forEach((point, index) => {
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
        break;
      }
      case 'note': {
        ctx.beginPath();
        ctx.arc(annotation.x, annotation.y, NOTE_MARKER_RADIUS_PX / scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `${NOTE_FONT_PX / scale}px system-ui, sans-serif`;
        ctx.textBaseline = 'middle';
        const textX = annotation.x + (NOTE_MARKER_RADIUS_PX * 2.5) / scale;
        const metrics = ctx.measureText(annotation.text);
        const paddingPx = 4 / scale;
        ctx.globalAlpha = alpha * 0.85;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(
          textX - paddingPx,
          annotation.y - NOTE_FONT_PX / scale / 2 - paddingPx,
          metrics.width + paddingPx * 2,
          NOTE_FONT_PX / scale + paddingPx * 2,
        );
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#000000';
        ctx.fillText(annotation.text, textX, annotation.y);
        break;
      }
    }
  }

  private drawArrow(start: { x: number; y: number }, end: { x: number; y: number }, scale: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLength = ARROWHEAD_LENGTH_PX / scale;
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headLength * Math.cos(angle - ARROWHEAD_ANGLE), end.y - headLength * Math.sin(angle - ARROWHEAD_ANGLE));
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headLength * Math.cos(angle + ARROWHEAD_ANGLE), end.y - headLength * Math.sin(angle + ARROWHEAD_ANGLE));
    ctx.stroke();
  }
}
