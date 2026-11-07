import type { ResolvedAnnotation } from '@artiso/core-engine';
import { viewMatrix, type ViewportState } from './viewport';

type Canvas2DContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const THICKNESS_PX: Record<'thin' | 'medium' | 'thick', number> = {
  thin: 1.5,
  medium: 3,
  thick: 5,
};

// Pencil pressure (0..1) to a multiple of the set line width: width only,
// never opacity. A medium press -- and a mouse, which reports 0.5 while its
// button is down -- draws at the set width; the lightest touch at a quarter
// of it and the hardest at 1.75 times.
const PRESSURE_MIN_FACTOR = 0.25;
const PRESSURE_MAX_FACTOR = 1.75;

export function pressureWidthFactor(pressure: number | undefined): number {
  if (pressure === undefined || !Number.isFinite(pressure)) return 1;
  const p = Math.min(1, Math.max(0, pressure));
  return PRESSURE_MIN_FACTOR + (PRESSURE_MAX_FACTOR - PRESSURE_MIN_FACTOR) * p;
}

// The line width of each segment of a freehand stroke: the base width times
// the average pressure factor of the segment's two ends (a point without
// pressure counts as the base width). Null when the width never varies -- no
// pressure at all, or a mouse's constant 0.5 -- so such a stroke is drawn as a
// single path, exactly as before pressure was used.
export function freehandSegmentWidths(
  points: readonly { x: number; y: number; pressure?: number }[],
  baseWidth: number,
): number[] | null {
  const factors = points.map((p) => pressureWidthFactor(p.pressure));
  if (factors.every((f) => f === factors[0])) return null;
  const widths: number[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    widths.push((baseWidth * (factors[i]! + factors[i + 1]!)) / 2);
  }
  return widths;
}

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
    pixelRatio = 1,
  ): void {
    const ctx = this.ctx;
    // canvasWidth/Height and the viewport are in CSS px; the backing store is
    // pixelRatio times larger.
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    ctx.save();
    // The one view transform (scale, translate and View Rotation).
    const m = viewMatrix(viewport);
    ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);

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
        const base = THICKNESS_PX[annotation.thickness] / scale;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        const widths = freehandSegmentWidths(annotation.points, base);
        if (!widths) {
          // No pressure to vary the width (mouse, finger, older strokes): one
          // path at the set width, exactly as before.
          ctx.lineWidth = base;
          ctx.beginPath();
          annotation.points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
          });
          ctx.stroke();
          break;
        }
        // Pencil pressure: each segment at its own width. Round caps join
        // the segments into one smooth stroke.
        for (let i = 0; i < widths.length; i++) {
          const a = annotation.points[i]!;
          const b = annotation.points[i + 1]!;
          ctx.lineWidth = widths[i]!;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
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
