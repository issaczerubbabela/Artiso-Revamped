import { screenQuad } from './cell-focus-layer';
import { viewMatrix, type Point, type ViewportState } from './viewport';

type Canvas2DContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Overlays that follow a pointer rather than the reference: the Pencil hover
// (crosshair, the hovered cell's outline and its label) and a Measurement
// (GLOSSARY.md). Both are view state only, drawn on the top canvas after the
// annotations; neither touches the image pipeline or the grid's geometry
// (ki-grid-image-independence).

const ACCENT = '#34e2e2'; // the general accent (docs/design.md §2)
const HALO = 'rgba(0, 0, 0, 0.55)';
const CHIP_FILL = 'rgba(19, 20, 22, 0.95)'; // the matte panel (docs/design.md §5)
const CHIP_BORDER = 'rgba(255, 255, 255, 0.16)';
const CHIP_INK = '#f2f3f5';
const CHIP_FONT_PX = 13;
const CHIP_PAD_X = 8;
const CHIP_HEIGHT = 24;
const CHIP_FONT = `500 ${CHIP_FONT_PX}px "JetBrains Mono", ui-monospace, monospace`;

// Where a label chip of `size` goes near `anchor` (all CSS px): `offset` px
// right of and above it, flipped to the other side of the anchor when that
// would run off the canvas, and finally kept inside it.
export function labelBox(
  anchor: Point,
  size: { w: number; h: number },
  canvas: { w: number; h: number },
  offset: number,
): { x: number; y: number } {
  let x = anchor.x + offset;
  let y = anchor.y - offset - size.h;
  if (x + size.w > canvas.w) x = anchor.x - offset - size.w;
  if (y < 0) y = anchor.y + offset;
  return {
    x: Math.min(Math.max(0, x), Math.max(0, canvas.w - size.w)),
    y: Math.min(Math.max(0, y), Math.max(0, canvas.h - size.h)),
  };
}

export interface PencilHoverOverlay {
  // The Pencil tip, in CSS px on the canvas.
  tip: Point;
  // The cell under the tip (content units), when squares are shown.
  cell: Rect | null;
  // That cell's name, e.g. "C4".
  label: string | null;
}

const CROSSHAIR_ARM_PX = 14;
const CROSSHAIR_GAP_PX = 3;
const HOVER_LABEL_OFFSET_PX = 18;

// Pencil hover: a thin crosshair at the tip, an outline on the cell under it
// and that cell's label in a small matte chip beside the tip.
export function drawPencilHover(
  ctx: Canvas2DContext,
  overlay: PencilHoverOverlay,
  view: ViewportState,
  canvasWidth: number,
  canvasHeight: number,
  pixelRatio = 1,
): void {
  ctx.save();
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.globalAlpha = 1;

  if (overlay.cell) {
    const quad = screenQuad(view, overlay.cell);
    ctx.beginPath();
    quad.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.lineJoin = 'miter';
    ctx.lineWidth = 3;
    ctx.strokeStyle = HALO;
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = ACCENT;
    ctx.stroke();
  }

  const { x, y } = overlay.tip;
  const arms = (): void => {
    ctx.beginPath();
    ctx.moveTo(x - CROSSHAIR_ARM_PX, y);
    ctx.lineTo(x - CROSSHAIR_GAP_PX, y);
    ctx.moveTo(x + CROSSHAIR_GAP_PX, y);
    ctx.lineTo(x + CROSSHAIR_ARM_PX, y);
    ctx.moveTo(x, y - CROSSHAIR_ARM_PX);
    ctx.lineTo(x, y - CROSSHAIR_GAP_PX);
    ctx.moveTo(x, y + CROSSHAIR_GAP_PX);
    ctx.lineTo(x, y + CROSSHAIR_ARM_PX);
  };
  ctx.lineCap = 'butt';
  arms();
  ctx.lineWidth = 3;
  ctx.strokeStyle = HALO;
  ctx.stroke();
  arms();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  if (overlay.label) drawChip(ctx, overlay.label, overlay.tip, canvasWidth, canvasHeight, HOVER_LABEL_OFFSET_PX);
  ctx.restore();
}

export interface MeasurementOverlay {
  // The line's ends, in content units (paper mm).
  start: Point;
  end: Point;
  // The readout, e.g. "42 mm · 1.7 cells".
  label: string;
}

const MEASURE_END_TICK_PX = 7;
const MEASURE_LABEL_OFFSET_PX = 12;

// A Measurement: the line between its ends with a short square tick across
// each end, and its readout in a matte chip beside the far end. The line
// follows the view; its width and the chip stay the same size on screen.
export function drawMeasurement(
  ctx: Canvas2DContext,
  overlay: MeasurementOverlay,
  view: ViewportState,
  canvasWidth: number,
  canvasHeight: number,
  pixelRatio = 1,
): void {
  const m = viewMatrix(view);
  const toScreen = (p: Point): Point => ({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f });
  const a = toScreen(overlay.start);
  const b = toScreen(overlay.end);
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  // The unit normal, for the end ticks (any direction for a zero-length line).
  const n = length > 0 ? { x: -(b.y - a.y) / length, y: (b.x - a.x) / length } : { x: 0, y: 1 };

  ctx.save();
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.globalAlpha = 1;
  const path = (): void => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    for (const p of [a, b]) {
      ctx.moveTo(p.x - n.x * MEASURE_END_TICK_PX, p.y - n.y * MEASURE_END_TICK_PX);
      ctx.lineTo(p.x + n.x * MEASURE_END_TICK_PX, p.y + n.y * MEASURE_END_TICK_PX);
    }
  };
  ctx.lineCap = 'round';
  path();
  ctx.lineWidth = 4;
  ctx.strokeStyle = HALO;
  ctx.stroke();
  path();
  ctx.lineWidth = 2;
  ctx.strokeStyle = ACCENT;
  ctx.stroke();

  drawChip(ctx, overlay.label, b, canvasWidth, canvasHeight, MEASURE_LABEL_OFFSET_PX);
  ctx.restore();
}

function drawChip(ctx: Canvas2DContext, text: string, anchor: Point, canvasWidth: number, canvasHeight: number, offset: number): void {
  ctx.font = CHIP_FONT;
  const w = Math.ceil(ctx.measureText(text).width) + CHIP_PAD_X * 2;
  const { x, y } = labelBox(anchor, { w, h: CHIP_HEIGHT }, { w: canvasWidth, h: canvasHeight }, offset);
  ctx.beginPath();
  roundRect(ctx, x, y, w, CHIP_HEIGHT, 6);
  ctx.fillStyle = CHIP_FILL;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = CHIP_BORDER;
  ctx.stroke();
  ctx.fillStyle = CHIP_INK;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, x + CHIP_PAD_X, y + CHIP_HEIGHT / 2);
}

// Canvas roundRect is missing from older WebKit, so the path is traced by hand.
function roundRect(ctx: Canvas2DContext, x: number, y: number, w: number, h: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
