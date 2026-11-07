import { viewMatrix, type Point, type ViewportState } from './viewport';

type Canvas2DContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const DEFAULT_CELL_FOCUS_DIM_PERCENT = 70;

// The darkening outside the focused cell (a percentage, 70 by default) as the
// alpha of the black drawn over it.
export function cellFocusDimAlpha(percent: number): number {
  if (!Number.isFinite(percent)) return DEFAULT_CELL_FOCUS_DIM_PERCENT / 100;
  return Math.min(1, Math.max(0, percent / 100));
}

// A content rect's four corners on screen (clockwise from its top-left), so it
// turns with the View Rotation like everything else.
export function screenQuad(view: ViewportState, rect: Rect): Point[] {
  const m = viewMatrix(view);
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
  ].map((p) => ({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f }));
}

// The Done Cell tick's size in CSS px for a cell `cellPx` across on screen:
// big enough to read at a glance, never filling a big cell.
export function doneTickSize(cellPx: number): number {
  return Math.round(Math.min(48, Math.max(8, cellPx * 0.4)));
}

export interface CellFocusOverlay {
  // The focused cell, in content units (paper mm).
  focus: Rect;
  // How dark everything outside it is, 0..100.
  dimPercent: number;
  // The Done Cells, each marked with a faint tick.
  done: readonly Rect[];
}

const FOCUS_OUTLINE = '#34e2e2'; // the general accent (docs/design.md §2)
const TICK_INK = 'rgba(255, 255, 255, 0.55)';
const TICK_SHADOW = 'rgba(0, 0, 0, 0.35)';

// Cell Focus over the reference (GLOSSARY.md): everything but the focused cell
// darkened, an accent outline round that cell, and a faint upright tick on
// every Done Cell. Drawn onto the grid canvas after the grid, through the one
// view transform, so it pans, zooms and turns with the reference. View state
// only: it never touches the image pipeline or the grid's geometry
// (ki-grid-image-independence).
export function drawCellFocus(
  ctx: Canvas2DContext,
  overlay: CellFocusOverlay,
  view: ViewportState,
  canvasWidth: number,
  canvasHeight: number,
  pixelRatio = 1,
): void {
  ctx.save();
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const quad = screenQuad(view, overlay.focus);

  // The dim: the whole canvas with the focused cell cut out of it.
  const alpha = cellFocusDimAlpha(overlay.dimPercent);
  if (alpha > 0) {
    ctx.beginPath();
    ctx.rect(0, 0, canvasWidth, canvasHeight);
    tracePolygon(ctx, quad);
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fill('evenodd');
  }

  for (const rect of overlay.done) drawTick(ctx, screenQuad(view, rect));

  ctx.beginPath();
  tracePolygon(ctx, quad);
  ctx.lineWidth = 2;
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = FOCUS_OUTLINE;
  ctx.stroke();
  ctx.restore();
}

function tracePolygon(ctx: Canvas2DContext, points: readonly Point[]): void {
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
}

// A check mark centred in the cell, kept upright on screen whatever the angle.
function drawTick(ctx: Canvas2DContext, quad: readonly Point[]): void {
  const [a, b, , d] = quad as [Point, Point, Point, Point];
  const centre = { x: (quad[0]!.x + quad[2]!.x) / 2, y: (quad[0]!.y + quad[2]!.y) / 2 };
  const cellPx = Math.min(Math.hypot(b.x - a.x, b.y - a.y), Math.hypot(d.x - a.x, d.y - a.y));
  const size = doneTickSize(cellPx);
  const s = size / 2;
  const path = (): void => {
    ctx.beginPath();
    ctx.moveTo(centre.x - s * 0.8, centre.y);
    ctx.lineTo(centre.x - s * 0.25, centre.y + s * 0.55);
    ctx.lineTo(centre.x + s * 0.8, centre.y - s * 0.55);
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  path();
  ctx.lineWidth = Math.max(3, size / 8) + 2;
  ctx.strokeStyle = TICK_SHADOW;
  ctx.stroke();
  path();
  ctx.lineWidth = Math.max(3, size / 8);
  ctx.strokeStyle = TICK_INK;
  ctx.stroke();
}
